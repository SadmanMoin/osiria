import { DATABASE_UNAVAILABLE_MESSAGE } from "@/lib/auth/constants";
import { toPublicUser } from "@/lib/auth/repository";
import { buildSessionCookie, clearSessionCookieHeader, cookieIsSecure } from "@/lib/auth/session-cookie";
import type { AuthFailure, AuthSuccess, MessageResult } from "@/lib/auth/service";

export function authFailureStatus(code: AuthFailure["code"]): number {
  switch (code) {
    case "VALIDATION":
    case "RESET_INVALID":
      return 400;
    case "INVALID_CREDENTIALS":
      return 401;
    case "ACCOUNT_UNAVAILABLE":
      return 403;
    case "EMAIL_TAKEN":
      return 409;
    case "RATE_LIMITED":
      return 429;
  }
}

export function authFailureResponse(result: AuthFailure): Response {
  const headers = new Headers();
  if (result.code === "RATE_LIMITED" && result.retryAfterSeconds) {
    headers.set("Retry-After", String(result.retryAfterSeconds));
  }
  return Response.json(
    {
      ok: false,
      message: result.message,
      fieldErrors: result.fieldErrors,
    },
    { status: authFailureStatus(result.code), headers },
  );
}

export function authSuccessResponse(result: AuthSuccess, status: number): Response {
  const response = Response.json({ ok: true, user: result.user }, { status });
  response.headers.append(
    "Set-Cookie",
    buildSessionCookie(result.sessionToken, { secure: cookieIsSecure() }),
  );
  return response;
}

export function messageResponse(result: MessageResult): Response {
  if (!result.ok) {
    return authFailureResponse(result);
  }
  return Response.json({ ok: true, message: result.message });
}

export function clearedSessionResponse(): Response {
  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", clearSessionCookieHeader(cookieIsSecure()));
  return response;
}

export function databaseUnavailableResponse(): Response {
  return Response.json({ ok: false, message: DATABASE_UNAVAILABLE_MESSAGE }, { status: 503 });
}

export function publicUserResponse(user: Parameters<typeof toPublicUser>[0]): Response {
  return Response.json({ ok: true, user: toPublicUser(user) });
}
