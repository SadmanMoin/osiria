import "server-only";

import { cookies } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import type { Area } from "@/lib/auth/authorization";
import { roleAllowed } from "@/lib/auth/authorization";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, type PublicUser } from "@/lib/auth/constants";
import { getAuthRepository } from "@/lib/auth/prisma-repository";
import { toPublicUser } from "@/lib/auth/repository";
import { hashSecretToken } from "@/lib/auth/tokens";
import { isDatabaseConfigured } from "@/lib/db/prisma";

export type Access =
  | { kind: "user"; user: PublicUser }
  | { kind: "anonymous" }
  | { kind: "forbidden"; user: PublicUser }
  | { kind: "unavailable" };

async function sessionUser(token: string): Promise<PublicUser | null> {
  const user = await getAuthRepository().findSessionUser(hashSecretToken(token), new Date());
  return user ? toPublicUser(user) : null;
}

export const getOptionalUser = cache(async (): Promise<PublicUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !isDatabaseConfigured()) {
    return null;
  }
  try {
    return await sessionUser(token);
  } catch {
    return null;
  }
});

export const accessForArea = cache(async (area: Area): Promise<Access> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return { kind: "anonymous" };
  }
  if (!isDatabaseConfigured()) {
    return { kind: "unavailable" };
  }
  try {
    const user = await sessionUser(token);
    if (!user) {
      return { kind: "anonymous" };
    }
    if (!roleAllowed(area, user.role)) {
      return { kind: "forbidden", user };
    }
    return { kind: "user", user };
  } catch {
    return { kind: "unavailable" };
  }
});

export async function requireArea(
  area: Area,
  loginNext: string,
): Promise<PublicUser | "unavailable"> {
  const access = await accessForArea(area);
  if (access.kind === "anonymous") {
    redirect(`/login?next=${encodeURIComponent(loginNext)}`);
  }
  if (access.kind === "forbidden") {
    forbidden();
  }
  if (access.kind === "unavailable") {
    return "unavailable";
  }
  return access.user;
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
