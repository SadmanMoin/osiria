import type { UserRole } from "@/lib/auth/constants";

export const AREA_ROLES = {
  admin: ["ADMIN"],
  worker: ["WORKER", "ADMIN"],
  advertiser: ["ADVERTISER", "ADMIN"],
  account: ["WORKER", "ADVERTISER", "ADMIN"],
} as const;

export type Area = keyof typeof AREA_ROLES;

export function roleAllowed(area: Area, role: UserRole): boolean {
  return (AREA_ROLES[area] as readonly UserRole[]).includes(role);
}

export function homeForRole(role: UserRole): string {
  if (role === "ADMIN") {
    return "/admin";
  }
  if (role === "ADVERTISER") {
    return "/advertiser";
  }
  return "/worker";
}

export function roleLabel(role: UserRole): string {
  if (role === "ADMIN") {
    return "Admin";
  }
  if (role === "ADVERTISER") {
    return "Advertiser";
  }
  return "Worker";
}

export function safeNextPath(next: string | null | undefined, role: UserRole): string {
  const fallback = homeForRole(role);
  if (!next) {
    return fallback;
  }
  if (
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\") ||
    next.includes("\0") ||
    /[\u0000-\u001F\u007F]/.test(next)
  ) {
    return fallback;
  }

  const path = next.split("?")[0] ?? next;
  if (path.startsWith("/admin") && role !== "ADMIN") {
    return fallback;
  }
  if (path.startsWith("/worker") && role !== "WORKER" && role !== "ADMIN") {
    return fallback;
  }
  if (path.startsWith("/advertiser") && role !== "ADVERTISER" && role !== "ADMIN") {
    return fallback;
  }
  if (path.startsWith("/api")) {
    return fallback;
  }
  return next;
}

export function proxyAuthDecision(input: {
  pathname: string;
  hasSessionCookie: boolean;
}): "allow" | "login" | "json-401" {
  const { pathname, hasSessionCookie } = input;
  const isSessionApi =
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/") ||
    pathname === "/api/worker" ||
    pathname.startsWith("/api/worker/") ||
    pathname === "/api/advertiser" ||
    pathname.startsWith("/api/advertiser/") ||
    pathname === "/api/submissions" ||
    pathname.startsWith("/api/submissions/");
  const isProtectedPage =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/worker" ||
    pathname.startsWith("/worker/") ||
    pathname === "/advertiser" ||
    pathname.startsWith("/advertiser/") ||
    pathname === "/account" ||
    pathname.startsWith("/account/");

  if (!isSessionApi && !isProtectedPage) {
    return "allow";
  }
  if (hasSessionCookie) {
    return "allow";
  }
  return isSessionApi ? "json-401" : "login";
}
