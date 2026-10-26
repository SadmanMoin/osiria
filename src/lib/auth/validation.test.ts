import { describe, expect, it } from "vitest";
import { parseLogin, parseRegistration } from "@/lib/auth/validation";

const password = "river-lamp-77-quiet";

describe("registration validation", () => {
  it("accepts a worker and normalizes email", () => {
    const result = parseRegistration({
      displayName: "  Ada   Lovelace ",
      email: "Ada@Example.com",
      password,
      confirmPassword: password,
      role: "WORKER",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.email).toBe("ada@example.com");
      expect(result.data.displayName).toBe("Ada Lovelace");
      expect(result.data.role).toBe("WORKER");
    }
  });

  it("rejects admin self-registration", () => {
    const result = parseRegistration({
      displayName: "Root",
      email: "root@example.com",
      password,
      confirmPassword: password,
      role: "ADMIN",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.role).toMatch(/Worker or Advertiser/);
    }
  });

  it("rejects mismatched passwords", () => {
    const result = parseRegistration({
      displayName: "Ada",
      email: "ada@example.com",
      password,
      confirmPassword: `${password}x`,
      role: "ADVERTISER",
    });
    expect(result.ok).toBe(false);
  });
});

describe("login validation", () => {
  it("does not apply the new-password policy", () => {
    const result = parseLogin({ email: "ada@example.com", password: "legacy" });
    expect(result.ok).toBe(true);
  });
});
