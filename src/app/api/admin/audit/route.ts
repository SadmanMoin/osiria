import { AREA_ROLES } from "@/lib/auth/authorization";
import { withRole } from "@/lib/auth/guard";
import { resolveSessionUser } from "@/lib/auth/resolve-session";
import { listPrismaAuditLogs } from "@/lib/security/audit";

export async function GET(request: Request) {
  return withRole(request, AREA_ROLES.admin, resolveSessionUser, async () =>
    Response.json({ ok: true, logs: await listPrismaAuditLogs({ limit: 100 }) }),
  );
}
