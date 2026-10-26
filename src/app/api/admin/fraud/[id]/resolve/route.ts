import { resolveSessionUser } from "@/lib/auth/resolve-session";
import { postResolveFraudEvent } from "@/lib/campaigns/http";
import { getCampaignStore } from "@/lib/campaigns/prisma-store";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  return postResolveFraudEvent(request, id, {
    resolveUser: resolveSessionUser,
    store: getCampaignStore(),
  });
}
