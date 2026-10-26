import { getCampaignStore } from "@/lib/campaigns/prisma-store";
import { getWorkerSubmissions, postWorkerSubmission } from "@/lib/campaigns/http";
import { resolveSessionUser } from "@/lib/auth/resolve-session";

function deps() {
  return {
    resolveUser: resolveSessionUser,
    store: getCampaignStore(),
  };
}

export async function GET(request: Request) {
  return getWorkerSubmissions(request, deps());
}

export async function POST(request: Request) {
  return postWorkerSubmission(request, deps());
}
