import { SESSION_COOKIE } from "@/lib/auth/constants";

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    if (key !== name) {
      continue;
    }
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  return null;
}

export function readSessionCookie(request: Request): string | null {
  return readCookie(request, SESSION_COOKIE);
}

export function rejectCrossOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return Response.json({ ok: false, message: "Forbidden." }, { status: 403 });
  }
  if (!origin) {
    return null;
  }
  try {
    const expected = process.env.APP_ORIGIN ?? new URL(request.url).origin;
    if (new URL(origin).origin !== new URL(expected).origin) {
      return Response.json({ ok: false, message: "Forbidden." }, { status: 403 });
    }
  } catch {
    return Response.json({ ok: false, message: "Forbidden." }, { status: 403 });
  }
  return null;
}

export function sanitizeOrigin(origin: string): string {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "http://localhost:3000";
    }
    return url.origin;
  } catch {
    return "http://localhost:3000";
  }
}

export function resolveAppOrigin(input: {
  appOrigin: string | undefined;
  nodeEnv: string | undefined;
  host: string | null;
  proto: string | null;
}): string {
  if (input.appOrigin) {
    return sanitizeOrigin(input.appOrigin);
  }
  if (input.nodeEnv === "production") {
    return "http://localhost:3000";
  }
  const proto = input.proto ?? "http";
  const host = input.host ?? "localhost:3000";
  return sanitizeOrigin(`${proto}://${host}`);
}

export function ipFromForwarded(forwarded: string | null, realIp: string | null): string {
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first.slice(0, 64);
    }
  }
  if (realIp) {
    return realIp.trim().slice(0, 64);
  }
  return "unknown";
}

export function ipFromRequest(request: Request): string {
  return ipFromForwarded(
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
  );
}

export function originForRequest(request: Request): string {
  return resolveAppOrigin({
    appOrigin: process.env.APP_ORIGIN,
    nodeEnv: process.env.NODE_ENV,
    host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    proto: request.headers.get("x-forwarded-proto"),
  });
}

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | Response> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) {
    return blocked;
  }
  try {
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 20_000) {
          await reader.cancel();
          return Response.json({ ok: false, message: "Request is too large." }, { status: 413 });
        }
        chunks.push(value);
      }
    }
    const text = Buffer.concat(chunks).toString("utf8");
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return Response.json(
        { ok: false, message: "Request body must be a JSON object." },
        { status: 400 },
      );
    }
    return value as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, message: "Request body must be JSON." }, { status: 400 });
  }
}
