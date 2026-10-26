import { getCampaignStore } from "@/lib/campaigns/prisma-store";
import { getWorkerPoints } from "@/lib/campaigns/http";
import { resolveSessionUser } from "@/lib/auth/resolve-session";

export async function GET(request: Request) {
  return getWorkerPoints(request, {
    resolveUser: resolveSessionUser,
    store: getCampaignStore(),
  });
}
