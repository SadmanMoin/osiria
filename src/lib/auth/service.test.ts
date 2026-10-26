import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { RESET_GENERIC_MESSAGE, RESET_SUCCESS_MESSAGE } from "@/lib/auth/constants";
import { createRateLimiter, type RateLimiter } from "@/lib/auth/rate-limit";
import type { AuthRepository, StoredUser } from "@/lib/auth/repository";
import {
  loginAccount,
  logoutAccount,
  registerAccount,
  requestPasswordReset,
  resetPassword,
  type AuthDeps,
} from "@/lib/auth/service";

const strongPassword = "river-lamp-77-quiet";

function createMemoryRepository(): AuthRepository & { users: StoredUser[]; sessions: number } {
  const users: StoredUser[] = [];
  const sessions: { userId: string; tokenHash: string; expiresAt: Date }[] = [];
  const resets: { userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null }[] = [];

  return {
    users,
    get sessions() {
      return sessions.length;
    },
    async findUserByEmail(email) {
      return users.find((user) => user.email === email) ?? null;
    },
    async createUser(input) {
      if (users.some((user) => user.email === input.email)) {
        return "EMAIL_TAKEN";
      }
      const user: StoredUser = {
        id: randomUUID(),
        email: input.email,
        displayName: input.displayName,
        role: input.role,
        status: "ACTIVE",
        passwordHash: input.passwordHash,
      };
      users.push(user);
      return user;
    },
    async createSession(input) {
      sessions.push(input);
    },
    async findSessionUser(tokenHash, now) {
      const session = sessions.find((item) => item.tokenHash === tokenHash);
      if (!session || session.expiresAt <= now) {
        return null;
      }
      const user = users.find((item) => item.id === session.userId) ?? null;
      if (!user || user.status !== "ACTIVE") {
        return null;
      }
      return user;
    },
    async deleteSession(tokenHash) {
      const index = sessions.findIndex((item) => item.tokenHash === tokenHash);
      if (index >= 0) {
        sessions.splice(index, 1);
      }
    },
    async deleteSessionsForUser(userId) {
      for (let index = sessions.length - 1; index >= 0; index -= 1) {
        if (sessions[index]?.userId === userId) {
          sessions.splice(index, 1);
        }
      }
    },
    async saveResetToken(input) {
      for (let index = resets.length - 1; index >= 0; index -= 1) {
        if (resets[index]?.userId === input.userId && resets[index]?.usedAt === null) {
          resets.splice(index, 1);
        }
      }
      resets.push({ ...input, usedAt: null });
    },
    async consumeResetToken(input) {
      const token = resets.find((item) => item.tokenHash === input.tokenHash);
      if (!token || token.usedAt || token.expiresAt <= input.now) {
        return "INVALID";
      }
      const user = users.find((item) => item.id === token.userId);
      if (!user) {
        return "INVALID";
      }
      token.usedAt = input.now;
      user.passwordHash = input.passwordHash;
      await this.deleteSessionsForUser(user.id);
      return "OK";
    },
  };
}

function deps(overrides: Partial<AuthDeps> = {}): AuthDeps & { tokens: string[] } {
  const tokens: string[] = [];
  let count = 0;
  const limit = (): RateLimiter => createRateLimiter(8, 60_000);
  return {
    tokens,
    now: new Date("2026-10-18T12:00:00.000Z"),
    hashPassword: async (password) => `hash:${password}`,
    verifyPassword: async (password, hash) => hash === `hash:${password}`,
    dummyPasswordHash: "hash:dummy",
    createToken: () => {
      count += 1;
      const token = `token-${String(count).padStart(24, "0")}`;
      tokens.push(token);
      return token;
    },
    hashToken: (token) => `hashed:${token}`,
    sessionTtlMs: 60 * 60 * 1000,
    resetTtlMs: 30 * 60 * 1000,
    loginRateLimit: limit(),
    registerRateLimit: limit(),
    resetRateLimit: limit(),
    resetConfirmRateLimit: limit(),
    deliverReset: async () => undefined,
    resetUrlFor: (token) => `http://localhost:3000/reset-password?token=${token}`,
    ...overrides,
  };
}

describe("account service", () => {
  it("registers a worker, rejects admin, and logs in without revealing which field failed", async () => {
    const repo = createMemoryRepository();
    const auth = deps();
    const created = await registerAccount(
      repo,
      {
        displayName: "Ada",
        email: "Ada@Example.com",
        password: strongPassword,
        confirmPassword: strongPassword,
        role: "WORKER",
      },
      "127.0.0.1",
      auth,
    );
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.user.role).toBe("WORKER");
      expect(created.user).not.toHaveProperty("passwordHash");
    }

    const admin = await registerAccount(
      repo,
      {
        displayName: "Root",
        email: "root@example.com",
        password: strongPassword,
        confirmPassword: strongPassword,
        role: "ADMIN",
      },
      "127.0.0.1",
      auth,
    );
    expect(admin.ok).toBe(false);
    expect(repo.users.some((user) => user.role === "ADMIN")).toBe(false);

    const missing = await loginAccount(
      repo,
      { email: "missing@example.com", password: strongPassword },
      "127.0.0.1",
      auth,
    );
    const wrong = await loginAccount(
      repo,
      { email: "ada@example.com", password: "not-the-password" },
      "127.0.0.1",
      auth,
    );
    expect(missing).toMatchObject({ ok: false, code: "INVALID_CREDENTIALS" });
    expect(wrong).toMatchObject({ ok: false, code: "INVALID_CREDENTIALS", message: missing.ok ? "" : missing.message });

    const signedIn = await loginAccount(
      repo,
      { email: "ada@example.com", password: strongPassword },
      "127.0.0.1",
      auth,
    );
    expect(signedIn.ok).toBe(true);
  });

  it("does not open a session for a suspended account with the right password", async () => {
    const repo = createMemoryRepository();
    const auth = deps();
    await registerAccount(
      repo,
      {
        displayName: "Ada",
        email: "ada@example.com",
        password: strongPassword,
        confirmPassword: strongPassword,
        role: "ADVERTISER",
      },
      "127.0.0.1",
      auth,
    );
    const user = repo.users[0];
    if (!user) {
      throw new Error("expected user");
    }
    user.status = "SUSPENDED";
    const result = await loginAccount(
      repo,
      { email: "ada@example.com", password: strongPassword },
      "127.0.0.1",
      auth,
    );
    expect(result).toMatchObject({ ok: false, code: "ACCOUNT_UNAVAILABLE" });
  });

  it("resets a password once, drops sessions, and hides the token from the response", async () => {
    const repo = createMemoryRepository();
    const sent: string[] = [];
    const auth = deps({
      deliverReset: async ({ resetUrl }) => {
        sent.push(resetUrl);
      },
    });
    const created = await registerAccount(
      repo,
      {
        displayName: "Ada",
        email: "ada@example.com",
        password: strongPassword,
        confirmPassword: strongPassword,
        role: "WORKER",
      },
      "127.0.0.1",
      auth,
    );
    if (!created.ok) {
      throw new Error("expected registration");
    }

    const unknown = await requestPasswordReset(repo, { email: "other@example.com" }, auth);
    expect(unknown).toEqual({ ok: true, message: RESET_GENERIC_MESSAGE });
    expect(sent).toHaveLength(0);

    const requested = await requestPasswordReset(repo, { email: "ada@example.com" }, auth);
    expect(requested).toEqual({ ok: true, message: RESET_GENERIC_MESSAGE });
    expect(JSON.stringify(requested)).not.toContain("token-");
    expect(sent[0]).toContain("token-");

    const token = sent[0]?.split("token=")[1] ?? "";
    await logoutAccount(repo, created.sessionToken, auth);
    const relogin = await loginAccount(
      repo,
      { email: "ada@example.com", password: strongPassword },
      "127.0.0.1",
      auth,
    );
    expect(relogin.ok).toBe(true);

    const nextPassword = "cedar-moon-88-quiet";
    const reset = await resetPassword(
      repo,
      { token, password: nextPassword, confirmPassword: nextPassword },
      "127.0.0.1",
      auth,
    );
    expect(reset).toEqual({ ok: true, message: RESET_SUCCESS_MESSAGE });
    expect(repo.sessions).toBe(0);

    const reused = await resetPassword(
      repo,
      { token, password: nextPassword, confirmPassword: nextPassword },
      "127.0.0.1",
      auth,
    );
    expect(reused).toMatchObject({ ok: false, code: "RESET_INVALID" });

    const oldPassword = await loginAccount(
      repo,
      { email: "ada@example.com", password: strongPassword },
      "127.0.0.1",
      auth,
    );
    expect(oldPassword).toMatchObject({ ok: false, code: "INVALID_CREDENTIALS" });
    const signedIn = await loginAccount(
      repo,
      { email: "ada@example.com", password: nextPassword },
      "127.0.0.1",
      auth,
    );
    expect(signedIn.ok).toBe(true);
  });

  it("rate limits repeated logins", async () => {
    const repo = createMemoryRepository();
    const auth = deps({ loginRateLimit: createRateLimiter(1, 60_000) });
    const first = await loginAccount(
      repo,
      { email: "ada@example.com", password: strongPassword },
      "127.0.0.1",
      auth,
    );
    const second = await loginAccount(
      repo,
      { email: "ada@example.com", password: strongPassword },
      "127.0.0.1",
      auth,
    );
    expect(first).toMatchObject({ ok: false, code: "INVALID_CREDENTIALS" });
    expect(second).toMatchObject({ ok: false, code: "RATE_LIMITED" });
  });
});
