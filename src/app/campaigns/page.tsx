import type { Metadata } from "next";
import Link from "next/link";
import { CampaignExplorer } from "@/components/campaigns/CampaignExplorer";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SampleDataNotice } from "@/components/ui/SampleDataNotice";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { sampleCampaigns } from "@/data/sample-campaigns";
import { getCampaignStore } from "@/lib/campaigns/prisma-store";
import type { StoredCampaign } from "@/lib/campaigns/types";

export const metadata: Metadata = {
  title: "Campaigns",
  description: "Browse live and preview Social-to-Earn campaigns.",
};

export const instant = false;

export default async function CampaignsPage() {
  const store = getCampaignStore();
  let liveCampaigns: StoredCampaign[] = [];
  try {
    liveCampaigns = await store.listCampaigns({ status: "OPEN" });
  } catch {
    liveCampaigns = [];
  }

  return (
    <Container className="py-16 sm:py-20">
      <SectionHeading
        eyebrow="Marketplace"
        title="Social-to-Earn Campaigns"
        description="Earn OP points by participating in active campaigns on X, Facebook, and Instagram."
      />

      {liveCampaigns.length > 0 ? (
        <div className="mt-10 space-y-6">
          <h2 className="font-display text-2xl tracking-tight">Active Campaigns</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {liveCampaigns.map((camp) => (
              <Card key={camp.id} className="flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-accent">
                      {camp.tasks.length} {camp.tasks.length === 1 ? "task" : "tasks"}
                    </span>
                    <span className="text-xs text-muted">
                      ${(camp.budgetSummary.availableBudgetMinor / 100).toFixed(2)} available
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-xl">{camp.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm text-muted">{camp.description}</p>
                </div>
                <div className="mt-6 border-t border-border pt-4">
                  <Link
                    href={`/campaigns/${camp.slug}`}
                    className="inline-flex items-center text-sm font-medium text-accent hover:underline"
                  >
                    View Tasks & Submit Proof &rarr;
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-14 border-t border-border pt-10">
        <h2 className="font-display text-2xl tracking-tight">Catalog Preview</h2>
        <div className="mt-4">
          <SampleDataNotice />
        </div>
        <div className="mt-8">
          <CampaignExplorer campaigns={sampleCampaigns} />
        </div>
      </div>
    </Container>
  );
}
