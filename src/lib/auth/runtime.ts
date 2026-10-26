import { RESET_TTL_MS, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/constants";
import { deliverPasswordReset, resetUrl } from "@/lib/auth/mailer";
import { getDummyPasswordHash, hashPassword, verifyPassword } from "@/lib/auth/password";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import type { AuthDeps } from "@/lib/auth/service";
import { createSecretToken, hashSecretToken } from "@/lib/auth/tokens";

const loginRateLimit = createRateLimiter(8, 15 * 60 * 1000);
const registerRateLimit = createRateLimiter(5, 60 * 60 * 1000);
const resetRateLimit = createRateLimiter(5, 60 * 60 * 1000);
const resetConfirmRateLimit = createRateLimiter(20, 15 * 60 * 1000);

export async function createProductionAuthDeps(origin: string, now = new Date()): Promise<AuthDeps> {
  return {
    now,
    hashPassword,
    verifyPassword,
    dummyPasswordHash: await getDummyPasswordHash(),
    createToken: createSecretToken,
    hashToken: hashSecretToken,
    sessionTtlMs: SESSION_MAX_AGE_SECONDS * 1000,
    resetTtlMs: RESET_TTL_MS,
    loginRateLimit,
    registerRateLimit,
    resetRateLimit,
    resetConfirmRateLimit,
    deliverReset: deliverPasswordReset,
    resetUrlFor: (token) => resetUrl(origin, token),
  };
}
