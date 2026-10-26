import { resolveSessionUser } from "@/lib/auth/resolve-session";
import { getEligibilityAuditLogs } from "@/lib/eligibility/http";
import { getEligibilityStore } from "@/lib/eligibility/prisma-store";
import { unconfiguredProfileSource } from "@/lib/eligibility/service";

function deps() {
  return {
    resolveUser: resolveSessionUser,
    store: getEligibilityStore(),
    source: unconfiguredProfileSource,
  };
}

export async function GET(request: Request) {
  return getEligibilityAuditLogs(request, deps());
}
