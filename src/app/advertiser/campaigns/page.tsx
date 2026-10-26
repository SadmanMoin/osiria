import type { Metadata } from "next";
import Link from "next/link";
import { CreateCampaignForm } from "@/components/campaigns/CampaignForms";
import { Protected } from "@/components/auth/Protected";
import { DatabaseUnavailable } from "@/components/auth/DatabaseUnavailable";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { getCampaignStore } from "@/lib/campaigns/prisma-store";
import type { StoredCampaign } from "@/lib/campaigns/types";

export const metadata: Metadata = {
  title: "Manage Campaigns",
  robots: { index: false, follow: false },
};

export default function AdvertiserCampaignsPage() {
  return (
    <Protected area="advertiser" loginNext="/advertiser/campaigns">
      {async (user) => {
        const store = getCampaignStore();
        let campaigns: StoredCampaign[] = [];
        try {
          campaigns = await store.listCampaigns({ ownerId: user.id });
        } catch {
          return <DatabaseUnavailable />;
        }

        return (
          <Container className="py-16">
            <div className="mb-4">
              <Link href="/advertiser" className="text-sm text-accent hover:underline">
                &larr; Back to Advertiser Dashboard
              </Link>
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              Campaign Management
            </p>
            <h1 className="mt-3 font-display text-4xl tracking-tight">Create & Fund Campaigns</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
              Campaign budgets and task rewards are kept strictly separated. Overspending is
              prevented by atomic ledger transactions. Newly created campaigns start in DRAFT
              until reviewed or opened by an admin.
            </p>

            <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <h2 className="font-display text-2xl tracking-tight">Create a New Campaign</h2>
                <p className="mt-1 text-sm text-muted">Define campaign details and the initial task.</p>
                <div className="mt-6">
                  <CreateCampaignForm />
                </div>
              </Card>

              <div className="space-y-6">
                <h2 className="font-display text-2xl tracking-tight">Your Campaigns ({campaigns.length})</h2>
                {campaigns.length === 0 ? (
                  <Card>
                    <p className="text-sm text-muted">You haven&apos;t created any campaigns yet.</p>
                  </Card>
                ) : (
                  campaigns.map((camp) => (
                    <Card key={camp.id} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="rounded-md border border-border px-2 py-0.5 text-xs font-medium uppercase text-accent">
                          {camp.status}
                        </span>
                        <span className="text-xs text-muted">
                          Budget: ${(camp.budgetMinor / 100).toFixed(2)}
                        </span>
                      </div>

                      <h3 className="font-display text-xl">{camp.title}</h3>
                      <p className="text-xs text-muted">Slug: /{camp.slug}</p>

                      <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
                        <div>
                          <span className="text-muted">Funded:</span>{" "}
                          <span className="font-semibold text-teal">
                            ${(camp.budgetSummary.totalFundedMinor / 100).toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted">Paid Out:</span>{" "}
                          <span className="font-semibold text-foreground">
                            ${(camp.budgetSummary.totalPaidMinor / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="border-t border-border pt-4">
                        <h4 className="text-xs font-semibold text-accent">Allocate Funds to Campaign</h4>
                        <div className="mt-2">
                          <p className="text-xs text-muted">Funding is unavailable until verified payment settlement is configured.</p>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </Container>
        );
      }}
    </Protected>
  );
}
