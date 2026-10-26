import { getCampaignStore } from "@/lib/campaigns/prisma-store";
import { postFundCampaign } from "@/lib/campaigns/http";
import { resolveSessionUser } from "@/lib/auth/resolve-session";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  return postFundCampaign(request, id, {
    resolveUser: resolveSessionUser,
    store: getCampaignStore(),
  });
}
