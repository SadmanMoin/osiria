import { resolveSessionUser } from "@/lib/auth/resolve-session";
import { postWorkerEligibility } from "@/lib/eligibility/http";
import { getEligibilityStore } from "@/lib/eligibility/prisma-store";
import { unconfiguredProfileSource } from "@/lib/eligibility/service";

export async function POST(request: Request) {
  return postWorkerEligibility(request, {
    resolveUser: resolveSessionUser,
    store: getEligibilityStore(),
    source: unconfiguredProfileSource,
  });
}
