import { describe, expect, it } from "vitest";
import {
  AREA_ROLES,
  homeForRole,
  proxyAuthDecision,
  roleAllowed,
  safeNextPath,
} from "@/lib/auth/authorization";

describe("role areas", () => {
  it("keeps admin pages admin-only", () => {
    expect(AREA_ROLES.admin).toEqual(["ADMIN"]);
    expect(roleAllowed("admin", "ADMIN")).toBe(true);
    expect(roleAllowed("admin", "WORKER")).toBe(false);
    expect(roleAllowed("admin", "ADVERTISER")).toBe(false);
  });

  it("sends each role to its own home", () => {
    expect(homeForRole("WORKER")).toBe("/worker");
    expect(homeForRole("ADVERTISER")).toBe("/advertiser");
    expect(homeForRole("ADMIN")).toBe("/admin");
  });

  it("blocks open redirects and cross-role next paths", () => {
    expect(safeNextPath("https://evil.example", "WORKER")).toBe("/worker");
    expect(safeNextPath("//evil.example", "WORKER")).toBe("/worker");
    expect(safeNextPath("/\\evil", "ADMIN")).toBe("/admin");
    expect(safeNextPath("/admin/users", "WORKER")).toBe("/worker");
    expect(safeNextPath("/admin/users", "ADMIN")).toBe("/admin/users");
    expect(safeNextPath("/worker", "ADVERTISER")).toBe("/advertiser");
    expect(safeNextPath("/api/admin/users", "ADMIN")).toBe("/admin");
  });
});

describe("proxy auth decision", () => {
  it("asks anonymous admin API calls for JSON 401 and pages for login", () => {
    expect(proxyAuthDecision({ pathname: "/api/admin/users", hasSessionCookie: false })).toBe(
      "json-401",
    );
    expect(proxyAuthDecision({ pathname: "/api/worker/eligibility", hasSessionCookie: false })).toBe(
      "json-401",
    );
    expect(proxyAuthDecision({ pathname: "/admin", hasSessionCookie: false })).toBe("login");
    expect(proxyAuthDecision({ pathname: "/campaigns", hasSessionCookie: false })).toBe("allow");
  });

  it("does not treat a cookie as a role grant", () => {
    expect(proxyAuthDecision({ pathname: "/admin", hasSessionCookie: true })).toBe("allow");
    expect(proxyAuthDecision({ pathname: "/api/admin/overview", hasSessionCookie: true })).toBe(
      "allow",
    );
  });
});
