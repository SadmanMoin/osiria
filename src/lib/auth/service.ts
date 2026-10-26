import {
  ACCOUNT_UNAVAILABLE_MESSAGE,
  EMAIL_TAKEN_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  RATE_LIMIT_MESSAGE,
  RESET_GENERIC_MESSAGE,
  RESET_INVALID_MESSAGE,
  RESET_SUCCESS_MESSAGE,
  type FieldErrors,
} from "@/lib/auth/constants";
import type { RateLimiter } from "@/lib/auth/rate-limit";
import { toPublicUser, type AuthRepository, type StoredUser } from "@/lib/auth/repository";
import { parseEmailAddress, parseLogin, parsePasswordReset, parseRegistration } from "@/lib/auth/validation";

export type AuthSuccess = {
  ok: true;
  user: ReturnType<typeof toPublicUser>;
  sessionToken: string;
};

export type AuthFailure = {
  ok: false;
  code:
    | "VALIDATION"
    | "EMAIL_TAKEN"
    | "INVALID_CREDENTIALS"
    | "ACCOUNT_UNAVAILABLE"
    | "RATE_LIMITED"
    | "RESET_INVALID";
  message: string;
  fieldErrors?: FieldErrors;
  retryAfterSeconds?: number;
};

export type AuthResult = AuthSuccess | AuthFailure;

export type MessageResult = { ok: true; message: string } | AuthFailure;

export type AuthDeps = {
  now: Date;
  hashPassword: (password: string) => Promise<string>;
  verifyPassword: (password: string, passwordHash: string) => Promise<boolean>;
  dummyPasswordHash: string;
  createToken: () => string;
  hashToken: (token: string) => string;
  sessionTtlMs: number;
  resetTtlMs: number;
  loginRateLimit: RateLimiter;
  registerRateLimit: RateLimiter;
  resetRateLimit: RateLimiter;
  resetConfirmRateLimit: RateLimiter;
  deliverReset: (input: { to: string; resetUrl: string }) => Promise<void>;
  resetUrlFor: (token: string) => string;
};

function failure(
  code: AuthFailure["code"],
  message: string,
  extra?: Pick<AuthFailure, "fieldErrors" | "retryAfterSeconds">,
): AuthFailure {
  return { ok: false, code, message, ...extra };
}

function rateLimited(retryAfterSeconds: number): AuthFailure {
  return failure("RATE_LIMITED", RATE_LIMIT_MESSAGE, { retryAfterSeconds });
}

async function openSession(
  repo: AuthRepository,
  user: StoredUser,
  deps: AuthDeps,
): Promise<AuthSuccess> {
  const sessionToken = deps.createToken();
  await repo.createSession({
    userId: user.id,
    tokenHash: deps.hashToken(sessionToken),
    expiresAt: new Date(deps.now.getTime() + deps.sessionTtlMs),
  });
  return { ok: true, user: toPublicUser(user), sessionToken };
}

export async function registerAccount(
  repo: AuthRepository,
  raw: {
    displayName: unknown;
    email: unknown;
    password: unknown;
    confirmPassword: unknown;
    role: unknown;
  },
  ip: string,
  deps: AuthDeps,
): Promise<AuthResult> {
  const parsed = parseRegistration(raw);
  if (!parsed.ok) {
    return failure("VALIDATION", parsed.message, { fieldErrors: parsed.fieldErrors });
  }
  const role: string = parsed.data.role;
  if (role !== "WORKER" && role !== "ADVERTISER") {
    return failure("VALIDATION", "Choose Worker or Advertiser.", {
      fieldErrors: { role: "Choose Worker or Advertiser." },
    });
  }

  const limit = deps.registerRateLimit.check(`register:ip:${ip}`, deps.now.getTime());
  if (!limit.ok) {
    return rateLimited(limit.retryAfterSeconds);
  }

  const passwordHash = await deps.hashPassword(parsed.data.password);
  const created = await repo.createUser({
    email: parsed.data.email,
    displayName: parsed.data.displayName,
    role: parsed.data.role,
    passwordHash,
  });
  if (created === "EMAIL_TAKEN") {
    return failure("EMAIL_TAKEN", EMAIL_TAKEN_MESSAGE, {
      fieldErrors: { email: EMAIL_TAKEN_MESSAGE },
    });
  }
  return openSession(repo, created, deps);
}

export async function loginAccount(
  repo: AuthRepository,
  raw: { email: unknown; password: unknown },
  ip: string,
  deps: AuthDeps,
): Promise<AuthResult> {
  const parsed = parseLogin(raw);
  if (!parsed.ok) {
    return failure("VALIDATION", parsed.message, { fieldErrors: parsed.fieldErrors });
  }

  const nowMs = deps.now.getTime();
  const emailLimit = deps.loginRateLimit.check(`login:email:${parsed.email}`, nowMs);
  if (!emailLimit.ok) {
    return rateLimited(emailLimit.retryAfterSeconds);
  }
  const ipLimit = deps.loginRateLimit.check(`login:ip:${ip}`, nowMs);
  if (!ipLimit.ok) {
    return rateLimited(ipLimit.retryAfterSeconds);
  }

  const user = await repo.findUserByEmail(parsed.email);
  const hash = user?.passwordHash ?? deps.dummyPasswordHash;
  const passwordOk = await deps.verifyPassword(parsed.password, hash);
  if (!user || !user.passwordHash || !passwordOk) {
    return failure("INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);
  }
  if (user.status !== "ACTIVE") {
    return failure("ACCOUNT_UNAVAILABLE", ACCOUNT_UNAVAILABLE_MESSAGE);
  }
  return openSession(repo, user, deps);
}

export async function logoutAccount(
  repo: AuthRepository,
  token: string | null,
  deps: Pick<AuthDeps, "hashToken">,
): Promise<void> {
  if (!token) {
    return;
  }
  await repo.deleteSession(deps.hashToken(token));
}

export async function requestPasswordReset(
  repo: AuthRepository,
  raw: { email: unknown; ip?: string },
  deps: AuthDeps,
): Promise<MessageResult> {
  const parsed = parseEmailAddress(raw.email);
  if (!parsed.ok) {
    return failure("VALIDATION", parsed.message, { fieldErrors: parsed.fieldErrors });
  }

  const ipLimit = deps.resetRateLimit.check(`reset:ip:${raw.ip ?? "unknown"}`, deps.now.getTime());
  if (!ipLimit.ok) return rateLimited(ipLimit.retryAfterSeconds);
  const limit = deps.resetRateLimit.check(`reset:email:${parsed.email}`, deps.now.getTime());
  if (!limit.ok) {
    return rateLimited(limit.retryAfterSeconds);
  }

  const user = await repo.findUserByEmail(parsed.email);
  if (!user || user.status !== "ACTIVE" || !user.passwordHash) {
    return { ok: true, message: RESET_GENERIC_MESSAGE };
  }

  const token = deps.createToken();
  await repo.saveResetToken({
    userId: user.id,
    tokenHash: deps.hashToken(token),
    expiresAt: new Date(deps.now.getTime() + deps.resetTtlMs),
  });
  try {
    await deps.deliverReset({ to: user.email, resetUrl: deps.resetUrlFor(token) });
  } catch {
    // Keep the response generic so delivery failure does not confirm the address.
  }
  return { ok: true, message: RESET_GENERIC_MESSAGE };
}

export async function resetPassword(
  repo: AuthRepository,
  raw: { token: unknown; password: unknown; confirmPassword: unknown },
  ip: string,
  deps: AuthDeps,
): Promise<MessageResult> {
  const parsed = parsePasswordReset(raw);
  if (!parsed.ok) {
    return failure("VALIDATION", parsed.message, { fieldErrors: parsed.fieldErrors });
  }

  const limit = deps.resetConfirmRateLimit.check(`reset-confirm:ip:${ip}`, deps.now.getTime());
  if (!limit.ok) {
    return rateLimited(limit.retryAfterSeconds);
  }

  const passwordHash = await deps.hashPassword(parsed.password);
  const consumed = await repo.consumeResetToken({
    tokenHash: deps.hashToken(parsed.token),
    passwordHash,
    now: deps.now,
  });
  if (consumed !== "OK") {
    return failure("RESET_INVALID", RESET_INVALID_MESSAGE);
  }
  return { ok: true, message: RESET_SUCCESS_MESSAGE };
}
