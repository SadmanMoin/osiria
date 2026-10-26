import { describe, expect, it } from "vitest";
import { createSlidingRateLimiter } from "@/lib/security/rate-limit";

describe("Rate Limiting", () => {
  it("allows requests within limit", () => {
    const limiter = createSlidingRateLimiter(3, 60_000);
    const now = Date.now();

    const r1 = limiter.check("user:alice", now);
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.remaining).toBe(2);

    const r2 = limiter.check("user:alice", now + 100);
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.remaining).toBe(1);

    const r3 = limiter.check("user:alice", now + 200);
    expect(r3.ok).toBe(true);
    if (r3.ok) expect(r3.remaining).toBe(0);
  });

  it("blocks requests exceeding limit", () => {
    const limiter = createSlidingRateLimiter(2, 60_000);
    const now = Date.now();

    limiter.check("user:bob", now);
    limiter.check("user:bob", now + 100);

    const blocked = limiter.check("user:bob", now + 200);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      expect(blocked.remaining).toBe(0);
    }
  });

  it("releases capacity after window expires", () => {
    const limiter = createSlidingRateLimiter(2, 1_000); // 1 second window
    const now = Date.now();

    limiter.check("user:carol", now);
    limiter.check("user:carol", now + 100);

    // Blocked during the window
    const blocked = limiter.check("user:carol", now + 200);
    expect(blocked.ok).toBe(false);

    // Allowed after the window
    const released = limiter.check("user:carol", now + 1_100);
    expect(released.ok).toBe(true);
  });

  it("isolates rate limits per key", () => {
    const limiter = createSlidingRateLimiter(1, 60_000);
    const now = Date.now();

    const r1 = limiter.check("user:alice", now);
    expect(r1.ok).toBe(true);

    const r2 = limiter.check("user:bob", now);
    expect(r2.ok).toBe(true);

    // Alice is blocked, but Bob is not
    const aliceBlocked = limiter.check("user:alice", now + 100);
    expect(aliceBlocked.ok).toBe(false);
  });

  it("reset clears all state", () => {
    const limiter = createSlidingRateLimiter(1, 60_000);
    const now = Date.now();

    limiter.check("user:alice", now);
    const blocked = limiter.check("user:alice", now + 100);
    expect(blocked.ok).toBe(false);

    limiter.reset();

    const afterReset = limiter.check("user:alice", now + 200);
    expect(afterReset.ok).toBe(true);
  });

  it("reset with key only clears that key", () => {
    const limiter = createSlidingRateLimiter(1, 60_000);
    const now = Date.now();

    limiter.check("user:alice", now);
    limiter.check("user:bob", now);

    limiter.reset("user:alice");

    const alice = limiter.check("user:alice", now + 100);
    expect(alice.ok).toBe(true);

    const bob = limiter.check("user:bob", now + 100);
    expect(bob.ok).toBe(false);
  });
});
