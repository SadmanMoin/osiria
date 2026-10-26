import { resolveSessionUser } from "@/lib/auth/resolve-session";
import { getAdminFraudEvents } from "@/lib/campaigns/http";
import { getCampaignStore } from "@/lib/campaigns/prisma-store";

export async function GET(request: Request) {
  return getAdminFraudEvents(request, {
    resolveUser: resolveSessionUser,
    store: getCampaignStore(),
  });
}
