import { getCampaignStore } from "@/lib/campaigns/prisma-store";
import { postSubmissionAppeal } from "@/lib/campaigns/http";
import { resolveSessionUser } from "@/lib/auth/resolve-session";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  return postSubmissionAppeal(request, id, {
    resolveUser: resolveSessionUser,
    store: getCampaignStore(),
  });
}
