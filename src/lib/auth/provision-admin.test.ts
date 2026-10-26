import { describe, expect, it } from "vitest";
import { validateAdminProvision } from "@/lib/auth/provision-admin";

describe("admin provisioning", () => {
  it("refuses a missing password and does not invent one", () => {
    const missing = validateAdminProvision(undefined, undefined);
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.message).toMatch(/does not include a default admin password/);
      expect(missing.message).not.toMatch(/password is /i);
    }
  });

  it("refuses publicly known admin passwords", () => {
    for (const password of ["admin", "password", "osiria-admin", "Admin12345678", "changeme123"]) {
      const result = validateAdminProvision("admin@example.com", password);
      expect(result.ok).toBe(false);
    }
  });

  it("accepts a unique operator-supplied password", () => {
    const result = validateAdminProvision("Admin@Example.com", "river-lamp-77-quiet");
    expect(result).toEqual({
      ok: true,
      email: "admin@example.com",
      password: "river-lamp-77-quiet",
    });
  });
});
