import { createSlidingRateLimiter } from "@/lib/security/rate-limit";
export type RateLimitDecision =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

export type RateLimiter = {
  check: (key: string, nowMs: number) => RateLimitDecision;
};

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const limiter = createSlidingRateLimiter(limit, windowMs);
  return { check: (key, nowMs) => limiter.check(key, nowMs) };
}
