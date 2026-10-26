import { readSessionCookie } from "@/lib/auth/http";
import { toPublicUser } from "@/lib/auth/repository";
import { databaseUnavailableResponse } from "@/lib/auth/responses";
import { resolveSessionUser } from "@/lib/auth/resolve-session";
import { hashSecretToken } from "@/lib/auth/tokens";

export async function GET(request: Request) {
  const token = readSessionCookie(request);
  if (!token) {
    return Response.json({ ok: true, user: null });
  }

  try {
    const user = await resolveSessionUser(hashSecretToken(token));
    return Response.json({ ok: true, user: user ? toPublicUser(user) : null });
  } catch {
    return databaseUnavailableResponse();
  }
}
