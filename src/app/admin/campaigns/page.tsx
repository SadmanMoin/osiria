import type { Metadata } from "next";
import Link from "next/link";
import { ModerateCampaignForm } from "@/components/campaigns/CampaignForms";
import { Protected } from "@/components/auth/Protected";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { getCampaignStore } from "@/lib/campaigns/prisma-store";
import type { StoredCampaign } from "@/lib/campaigns/types";

export const metadata: Metadata = {
  title: "Moderate Campaigns",
  robots: { index: false, follow: false },
};

export default function AdminCampaignsPage() {
  return (
    <Protected area="admin" loginNext="/admin/campaigns">
      {async () => {
        const store = getCampaignStore();
        let campaigns: StoredCampaign[] = [];
        try {
          campaigns = await store.listCampaigns();
        } catch {
          campaigns = [];
        }

        return (
          <Container className="py-16">
            <div className="mb-4">
              <Link href="/admin" className="text-sm text-accent hover:underline">
                &larr; Back to Admin Operations
              </Link>
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Admin</p>
            <h1 className="mt-3 font-display text-4xl tracking-tight">Campaign Moderation</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
              Review advertiser campaigns, moderate their status (Open, Pause, Close), and oversee
              budget allocation integrity.
            </p>

            <div className="mt-8 space-y-6">
              {campaigns.length === 0 ? (
                <Card>
                  <p className="text-sm text-muted">No campaigns submitted yet.</p>
                </Card>
              ) : (
                campaigns.map((camp) => (
                  <Card key={camp.id} className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span
                          className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold uppercase ${
                            camp.status === "OPEN"
                              ? "border-teal/50 bg-teal/10 text-teal"
                              : camp.status === "DRAFT"
                                ? "border-accent/50 bg-accent/10 text-accent"
                                : camp.status === "PAUSED"
                                  ? "border-border bg-background text-muted"
                                  : "border-danger/50 bg-danger/10 text-danger"
                          }`}
                        >
                          {camp.status}
                        </span>
                        <h2 className="mt-2 font-display text-2xl">{camp.title}</h2>
                        <p className="text-xs text-muted">
                          By {camp.ownerName} · Slug: /{camp.slug}
                        </p>
                      </div>

                      <div className="text-right text-xs">
                        <p className="text-muted">Available Budget</p>
                        <p className="font-display text-xl text-accent">
                          ${(camp.budgetSummary.availableBudgetMinor / 100).toFixed(2)}
                        </p>
                        <p className="text-muted">
                          Cap: ${(camp.budgetMinor / 100).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-foreground">{camp.description}</p>

                    <div className="border-t border-border pt-4">
                      <h3 className="text-xs font-semibold text-accent uppercase tracking-wider">
                        Tasks ({camp.tasks.length})
                      </h3>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {camp.tasks.map((task) => (
                          <div
                            key={task.id}
                            className="rounded-lg border border-border/80 bg-background/50 p-2 text-xs"
                          >
                            <span className="font-semibold text-accent">[{task.platform}]</span>{" "}
                            {task.title} — {task.rewardPoints} OP (Slots: {task.slotsFilled}/{task.slotsTotal})
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-border pt-4">
                      <h3 className="mb-2 text-xs font-semibold text-muted">Moderate Campaign Status</h3>
                      <ModerateCampaignForm campaignId={camp.id} />
                    </div>
                  </Card>
                ))
              )}
            </div>
          </Container>
        );
      }}
    </Protected>
  );
}
