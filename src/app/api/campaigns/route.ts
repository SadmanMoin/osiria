import { getCampaignStore } from "@/lib/campaigns/prisma-store";
import { getPublicCampaigns } from "@/lib/campaigns/http";
import { resolveSessionUser } from "@/lib/auth/resolve-session";

export async function GET(request: Request) {
  return getPublicCampaigns(request, {
    resolveUser: resolveSessionUser,
    store: getCampaignStore(),
  });
}
