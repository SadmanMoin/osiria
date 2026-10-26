import { resolveSessionUser } from "@/lib/auth/resolve-session";
import { getEligibilityReviews, postEligibilityReview } from "@/lib/eligibility/http";
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
  return getEligibilityReviews(request, deps());
}

export async function POST(request: Request) {
  return postEligibilityReview(request, deps());
}
