import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/auth/rate-limit";

describe("rate limiter", () => {
  it("blocks after the limit inside the window", () => {
    const limiter = createRateLimiter(2, 1_000);
    expect(limiter.check("login", 0).ok).toBe(true);
    expect(limiter.check("login", 10).ok).toBe(true);
    const blocked = limiter.check("login", 20);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
    expect(limiter.check("login", 1_100).ok).toBe(true);
  });
});
