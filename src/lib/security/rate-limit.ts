import { ipFromRequest } from "@/lib/auth/http";
import type { RateLimitDecision } from "@/lib/security/types";

export type RateLimiterInstance = {
  check: (key: string, nowMs?: number) => RateLimitDecision;
  reset: (key?: string) => void;
};

export function createSlidingRateLimiter(limit: number, windowMs: number): RateLimiterInstance {
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs < 1) throw new Error("Invalid rate limit configuration.");
  const hits = new Map<string, number[]>();
  const maxKeys = 10_000;

  return {
    check(key: string, nowMs = Date.now()): RateLimitDecision {
      if (!hits.has(key) && hits.size >= maxKeys) {
        for (const [storedKey, times] of hits) {
          if (times.every((time) => nowMs - time >= windowMs)) hits.delete(storedKey);
        }
        if (hits.size >= maxKeys) return { ok: false, remaining: 0, limit, resetAtMs: nowMs + windowMs, retryAfterSeconds: Math.ceil(windowMs / 1000) };
      }
      const existing = hits.get(key) ?? [];
      const recent = existing.filter((time) => nowMs - time < windowMs);

      if (recent.length >= limit) {
        const oldest = recent[0] ?? nowMs;
        const resetAtMs = oldest + windowMs;
        const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000));
        hits.set(key, recent);
        return {
          ok: false,
          remaining: 0,
          limit,
          resetAtMs,
          retryAfterSeconds,
        };
      }

      recent.push(nowMs);
      hits.set(key, recent);
      const remaining = limit - recent.length;
      const oldest = recent[0] ?? nowMs;
      const resetAtMs = oldest + windowMs;

      return {
        ok: true,
        remaining,
        limit,
        resetAtMs,
      };
    },

    reset(key?: string) {
      if (key) {
        hits.delete(key);
      } else {
        hits.clear();
      }
    },
  };
}

// Global Rate Limiter Presets
export const authRateLimiter = createSlidingRateLimiter(5, 60 * 1000); // 5 attempts per min
export const submissionRateLimiter = createSlidingRateLimiter(10, 60 * 1000); // 10 proofs per min
export const fundingRateLimiter = createSlidingRateLimiter(5, 60 * 1000); // 5 fund actions per min
export const generalApiLimiter = createSlidingRateLimiter(60, 60 * 1000); // 60 requests per min

/**
 * Creates a standard 429 Too Many Requests response with HTTP rate limit headers.
 */
export function rateLimitExceededResponse(decision: Extract<RateLimitDecision, { ok: false }>): Response {
  return Response.json(
    {
      ok: false,
      message: `Too many requests. Please wait ${decision.retryAfterSeconds} seconds before retrying.`,
      retryAfterSeconds: decision.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(decision.retryAfterSeconds),
        "X-RateLimit-Limit": String(decision.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(decision.resetAtMs / 1000)),
      },
    },
  );
}

/**
 * Enforces rate limiting on a Next.js / Fetch Request.
 * Returns null if allowed, or a 429 Response if blocked.
 */
export function checkRequestRateLimit(
  request: Request,
  limiter: RateLimiterInstance,
  actionKey: string,
  userId?: string,
): Response | null {
  const ip = ipFromRequest(request);
  const key = userId ? `${actionKey}:user:${userId}` : `${actionKey}:ip:${ip}`;
  const decision = limiter.check(key);

  if (!decision.ok) {
    return rateLimitExceededResponse(decision);
  }

  return null;
}
