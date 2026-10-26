import { describe, expect, it } from "vitest";
import { AREA_ROLES } from "@/lib/auth/authorization";
import { authorizeToken, withRole } from "@/lib/auth/guard";
import type { StoredUser } from "@/lib/auth/repository";
import { toPublicUser } from "@/lib/auth/repository";
import { hashSecretToken } from "@/lib/auth/tokens";

function user(role: StoredUser["role"], status: StoredUser["status"] = "ACTIVE"): StoredUser {
  return {
    id: "user-1",
    email: "ada@example.com",
    displayName: "Ada",
    role,
    status,
    passwordHash: "secret-hash",
  };
}

describe("authorizeToken", () => {
  it("rejects a missing session and a suspended account", async () => {
    const missing = await authorizeToken({
      token: null,
      allowedRoles: AREA_ROLES.admin,
      resolveUser: async () => user("ADMIN"),
      hashToken: (token) => token,
    });
    expect(missing).toMatchObject({ ok: false, status: 401 });

    const suspended = await authorizeToken({
      token: "token",
      allowedRoles: AREA_ROLES.account,
      resolveUser: async () => user("WORKER", "SUSPENDED"),
      hashToken: (token) => token,
    });
    expect(suspended).toMatchObject({ ok: false, status: 401 });
  });
});

describe("admin route guard", () => {
  it("returns 401, 403, and a public admin payload without the password hash", async () => {
    const anonymous = new Request("http://localhost/api/admin/overview");
    let called = false;
    const unauthorized = await withRole(anonymous, AREA_ROLES.admin, async () => user("ADMIN"), () => {
      called = true;
      return Response.json({ ok: true });
    });
    expect(unauthorized.status).toBe(401);
    expect(called).toBe(false);

    const workerRequest = new Request("http://localhost/api/admin/users", {
      headers: { cookie: "osiria_session=raw-token" },
    });
    const forbidden = await withRole(
      workerRequest,
      AREA_ROLES.admin,
      async (tokenHash) => {
        expect(tokenHash).toBe(hashSecretToken("raw-token"));
        return user("WORKER");
      },
      () => {
        called = true;
        return Response.json({ ok: true, users: [] });
      },
    );
    expect(forbidden.status).toBe(403);
    expect(called).toBe(false);

    const adminRequest = new Request("http://localhost/api/admin/overview", {
      headers: { cookie: "osiria_session=raw-token" },
    });
    const allowed = await withRole(adminRequest, AREA_ROLES.admin, async () => user("ADMIN"), (account) =>
      Response.json({ ok: true, user: toPublicUser(account) }),
    );
    expect(allowed.status).toBe(200);
    const body = await allowed.json();
    expect(body.user.role).toBe("ADMIN");
    expect(JSON.stringify(body)).not.toContain("secret-hash");
    expect(body.user.passwordHash).toBeUndefined();
  });

  it("returns 503 when the session lookup fails", async () => {
    const request = new Request("http://localhost/api/admin/overview", {
      headers: { cookie: "osiria_session=raw-token" },
    });
    const response = await withRole(request, AREA_ROLES.admin, async () => {
      throw new Error("database down");
    }, () => Response.json({ ok: true }));
    expect(response.status).toBe(503);
  });
});
