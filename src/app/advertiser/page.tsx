import type { Metadata } from "next";
import { Protected } from "@/components/auth/Protected";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { roleLabel } from "@/lib/auth/authorization";
import { getCampaignStore } from "@/lib/campaigns/prisma-store";
import type { StoredCampaign, StoredSubmission } from "@/lib/campaigns/types";

export const metadata: Metadata = {
  title: "Advertiser Dashboard",
  robots: { index: false, follow: false },
};

export default function AdvertiserPage() {
  return (
    <Protected area="advertiser" loginNext="/advertiser">
      {async (user) => {
        const store = getCampaignStore();
        let campaigns: StoredCampaign[] = [];
        let pendingSubmissions: StoredSubmission[] = [];
        let funds = {
          totalDepositedMinor: 0,
          totalAllocatedMinor: 0,
          pendingDepositsMinor: 0,
          availableBalanceMinor: 0,
        };

        try {
          [campaigns, pendingSubmissions, funds] = await Promise.all([
            store.listCampaigns({ ownerId: user.id }),
            store.listSubmissions({ ownerId: user.id, status: "PENDING" }),
            store.getAdvertiserFundsSummary(user.id),
          ]);
        } catch {
          // If db not reachable during static build
        }

        return (
          <Container className="py-16">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              Advertiser Dashboard
            </p>
            <h1 className="mt-3 font-display text-4xl tracking-tight">Welcome, {user.displayName}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
              Signed in as {roleLabel(user.role)}. Create and fund campaigns, set task requirements,
              and review worker submissions.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <Card>
                <p className="text-sm text-muted">My Campaigns</p>
                <p className="mt-2 font-display text-3xl">{campaigns.length}</p>
                <p className="mt-1 text-xs text-muted">
                  {campaigns.filter((c) => c.status === "OPEN").length} active
                </p>
              </Card>

              <Card>
                <p className="text-sm text-muted">Pending Submissions</p>
                <p className="mt-2 font-display text-3xl text-accent">{pendingSubmissions.length}</p>
                <p className="mt-1 text-xs text-muted">Awaiting your approval</p>
              </Card>

              <Card>
                <p className="text-sm text-muted">Allocated Budget</p>
                <p className="mt-2 font-display text-3xl">
                  ${(funds.totalAllocatedMinor / 100).toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-muted">Across all campaigns</p>
              </Card>
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <Button href="/advertiser/campaigns" variant="secondary">
                Manage Campaigns
              </Button>
              <Button href="/advertiser/reviews" variant="secondary">
                Review Submissions ({pendingSubmissions.length})
              </Button>
              <Button href="/campaigns" variant="ghost">
                Marketplace Preview
              </Button>
              <Button href="/account" variant="ghost">
                Account Settings
              </Button>
            </div>
          </Container>
        );
      }}
    </Protected>
  );
}
