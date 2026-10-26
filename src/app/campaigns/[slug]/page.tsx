import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitProofForm } from "@/components/campaigns/CampaignForms";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { getOptionalUser } from "@/lib/auth/session";
import { getCampaignStore } from "@/lib/campaigns/prisma-store";

export const metadata: Metadata = {
  title: "Campaign Details",
};

export const instant = false;

export default async function CampaignDetailPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const store = getCampaignStore();
  const campaign = await store.findCampaignBySlug(slug);

  if (!campaign) {
    notFound();
  }

  const user = await getOptionalUser();
  if (campaign.status !== "OPEN" && (!user || (user.role !== "ADMIN" && user.id !== campaign.ownerId))) {
    notFound();
  }

  return (
    <Container className="py-16">
      <div className="mb-6">
        <Link href="/campaigns" className="text-sm text-accent hover:underline">
          &larr; Back to all campaigns
        </Link>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <span className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
            {campaign.status}
          </span>
          <h1 className="mt-3 font-display text-4xl tracking-tight">{campaign.title}</h1>
          <p className="mt-2 text-sm text-muted">Created by {campaign.ownerName}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-muted">Available Budget</p>
          <p className="font-display text-2xl text-accent">
            ${(campaign.budgetSummary.availableBudgetMinor / 100).toFixed(2)}
          </p>
        </div>
      </div>

      <p className="mt-6 max-w-3xl text-sm leading-6 text-foreground">{campaign.description}</p>

      <div className="mt-12">
        <h2 className="font-display text-2xl tracking-tight">Campaign Tasks</h2>
        <p className="mt-1 text-sm text-muted">
          Complete the instructions and submit your proof URL to earn OP rewards.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {campaign.tasks.map((task) => {
            const slotsLeft = task.slotsTotal - task.slotsFilled;
            return (
              <Card key={task.id}>
                <div className="flex items-center justify-between">
                  <span className="rounded-full border border-border bg-background px-3 py-0.5 text-xs font-medium text-foreground">
                    {task.platform}
                  </span>
                  <span className="font-display text-lg text-accent">
                    {task.rewardPoints} OP (${(task.rewardAmountMinor / 100).toFixed(2)})
                  </span>
                </div>

                <h3 className="mt-3 font-display text-xl">{task.title}</h3>
                <p className="mt-2 text-sm text-muted">{task.instructions}</p>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-xs text-muted">
                  <span>
                    Slots: {task.slotsFilled} / {task.slotsTotal} filled
                  </span>
                  <span className={slotsLeft > 0 ? "text-teal" : "text-danger"}>
                    {slotsLeft > 0 ? `${slotsLeft} slots remaining` : "Filled"}
                  </span>
                </div>

                <div className="mt-6 border-t border-border pt-4">
                  {user?.role === "WORKER" ? (
                    slotsLeft > 0 ? (
                      <SubmitProofForm taskId={task.id} />
                    ) : (
                      <p className="text-xs text-danger">This task has reached its maximum slot capacity.</p>
                    )
                  ) : user ? (
                    <p className="text-xs text-muted">
                      Only worker accounts can submit task proofs. (Signed in as {user.role})
                    </p>
                  ) : (
                    <Button href="/login" variant="secondary" className="w-full">
                      Log in as Worker to Submit
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </Container>
  );
}
