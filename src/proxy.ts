import { NextResponse, type NextRequest } from "next/server";
import { proxyAuthDecision } from "@/lib/auth/authorization";
import { AUTH_REQUIRED_MESSAGE, SESSION_COOKIE } from "@/lib/auth/constants";

// Cookie presence is only an early redirect. Pages and protected API handlers
// check the database session and role before returning protected data.
export function proxy(request: NextRequest) {
  const decision = proxyAuthDecision({
    pathname: request.nextUrl.pathname,
    hasSessionCookie: Boolean(request.cookies.get(SESSION_COOKIE)?.value),
  });

  if (decision === "allow") {
    return NextResponse.next();
  }

  if (decision === "json-401") {
    return NextResponse.json({ ok: false, message: AUTH_REQUIRED_MESSAGE }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/worker",
    "/worker/:path*",
    "/advertiser",
    "/advertiser/:path*",
    "/account",
    "/account/:path*",
    "/api/admin",
    "/api/admin/:path*",
    "/api/worker",
    "/api/worker/:path*",
    "/api/advertiser",
    "/api/advertiser/:path*",
    "/api/submissions",
    "/api/submissions/:path*",
  ],
};
