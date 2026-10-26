import { safeErrorResponse } from "@/lib/security/errors";
import { unstable_rethrow } from "next/navigation";
import {
  AUTH_REQUIRED_MESSAGE,
  FORBIDDEN_MESSAGE,
  type UserRole,
} from "@/lib/auth/constants";
import { generalApiLimiter, rateLimitExceededResponse } from "@/lib/security/rate-limit";
import { readSessionCookie } from "@/lib/auth/http";
import type { StoredUser } from "@/lib/auth/repository";
import { hashSecretToken } from "@/lib/auth/tokens";

export type AccessDecision =
  | { ok: true; user: StoredUser }
  | { ok: false; status: 401 | 403; message: string };

export async function authorizeToken(input: {
  token: string | null;
  allowedRoles: readonly UserRole[];
  resolveUser: (tokenHash: string) => Promise<StoredUser | null>;
  hashToken: (token: string) => string;
}): Promise<AccessDecision> {
  if (!input.token) {
    return { ok: false, status: 401, message: AUTH_REQUIRED_MESSAGE };
  }

  const user = await input.resolveUser(input.hashToken(input.token));
  if (!user || user.status !== "ACTIVE") {
    return { ok: false, status: 401, message: AUTH_REQUIRED_MESSAGE };
  }
  if (!(input.allowedRoles as readonly UserRole[]).includes(user.role)) {
    return { ok: false, status: 403, message: FORBIDDEN_MESSAGE };
  }
  return { ok: true, user };
}

export async function withRole(
  request: Request,
  allowedRoles: readonly UserRole[],
  resolveUser: (tokenHash: string) => Promise<StoredUser | null>,
  handler: (user: StoredUser) => Promise<Response> | Response,
): Promise<Response> {
  try {
    const decision = await authorizeToken({
      token: readSessionCookie(request),
      allowedRoles,
      resolveUser,
      hashToken: hashSecretToken,
    });
    if (!decision.ok) {
      return Response.json(
        { ok: false, message: decision.message },
        { status: decision.status },
      );
    }
    const limit = generalApiLimiter.check(`api:${decision.user.id}`);
    if (!limit.ok) return rateLimitExceededResponse(limit);
    const response = await handler(decision.user);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    unstable_rethrow(error);
    return safeErrorResponse(error, 503);
  }
}
