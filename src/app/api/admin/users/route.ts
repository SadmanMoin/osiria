import { listAccounts } from "@/lib/auth/admin-data";
import { AREA_ROLES } from "@/lib/auth/authorization";
import { withRole } from "@/lib/auth/guard";
import { databaseUnavailableResponse } from "@/lib/auth/responses";
import { resolveSessionUser } from "@/lib/auth/resolve-session";

export async function GET(request: Request) {
  return withRole(request, AREA_ROLES.admin, resolveSessionUser, async () => {
    try {
      const users = await listAccounts();
      return Response.json({ ok: true, users });
    } catch {
      return databaseUnavailableResponse();
    }
  });
}
