import { getCampaignStore } from "@/lib/campaigns/prisma-store";
import { postAdvertiserCampaign } from "@/lib/campaigns/http";
import { resolveSessionUser } from "@/lib/auth/resolve-session";

export async function POST(request: Request) {
  return postAdvertiserCampaign(request, {
    resolveUser: resolveSessionUser,
    store: getCampaignStore(),
  });
}
