import { describe, expect, it } from "vitest";
import { hashPassword, isBlockedPassword, validatePassword, verifyPassword } from "@/lib/auth/password";

describe("password policy", () => {
  it("rejects short, common, and admin-shaped passwords", () => {
    expect(validatePassword("short1", "a@example.com").ok).toBe(false);
    expect(validatePassword("password1234", "a@example.com").ok).toBe(false);
    expect(validatePassword("Admin12345678", "a@example.com").ok).toBe(false);
    expect(validatePassword("osiria-admin", "a@example.com").ok).toBe(false);
    expect(isBlockedPassword("admin")).toBe(true);
  });

  it("accepts a unique password", () => {
    expect(validatePassword("river-lamp-77-quiet", "a@example.com").ok).toBe(true);
  });
});

describe("password hashing", () => {
  it("verifies the original password and rejects others", async () => {
    const hash = await hashPassword("river-lamp-77-quiet");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("river-lamp-77-quiet");
    expect(await verifyPassword("river-lamp-77-quiet", hash)).toBe(true);
    expect(await verifyPassword("river-lamp-77-other", hash)).toBe(false);
    expect(await verifyPassword("river-lamp-77-quiet", "not-a-hash")).toBe(false);
  });
});
