import { describe, expect, it } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { buildSessionCookie, clearSessionCookieHeader } from "@/lib/auth/session-cookie";

describe("session cookie", () => {
  it("is httpOnly, lax, and secure only when requested", () => {
    const secure = buildSessionCookie("raw-token", { secure: true, maxAgeSeconds: 60 });
    expect(secure).toContain(`${SESSION_COOKIE}=raw-token`);
    expect(secure).toContain("HttpOnly");
    expect(secure).toContain("SameSite=Lax");
    expect(secure).toContain("Secure");
    expect(secure).toContain("Max-Age=60");

    const local = buildSessionCookie("raw-token", { secure: false });
    expect(local).not.toContain("Secure");
  });

  it("clears the cookie without leaving the token", () => {
    const cleared = clearSessionCookieHeader(true);
    expect(cleared.startsWith(`${SESSION_COOKIE}=;`)).toBe(true);
    expect(cleared).toContain("Max-Age=0");
    expect(cleared).toContain("HttpOnly");
  });
});
