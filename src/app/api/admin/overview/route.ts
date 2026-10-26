import { AREA_ROLES } from "@/lib/auth/authorization";
import { withRole } from "@/lib/auth/guard";
import { toPublicUser } from "@/lib/auth/repository";
import { resolveSessionUser } from "@/lib/auth/resolve-session";

export async function GET(request: Request) {
  return withRole(request, AREA_ROLES.admin, resolveSessionUser, (user) =>
    Response.json({ ok: true, user: toPublicUser(user) }),
  );
}
