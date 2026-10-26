import type { Metadata } from "next";
import Link from "next/link";
import { AppealSubmissionForm } from "@/components/campaigns/CampaignForms";
import { Protected } from "@/components/auth/Protected";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { getCampaignStore } from "@/lib/campaigns/prisma-store";
import type { StoredSubmission } from "@/lib/campaigns/types";

export const metadata: Metadata = {
  title: "My Submissions",
  robots: { index: false, follow: false },
};

export default function WorkerSubmissionsPage() {
  return (
    <Protected area="worker" loginNext="/worker/submissions">
      {async (user) => {
        const store = getCampaignStore();
        let submissions: StoredSubmission[] = [];
        try {
          submissions = await store.listSubmissions({ userId: user.id });
        } catch {
          submissions = [];
        }

        return (
          <Container className="py-16">
            <div className="mb-4">
              <Link href="/worker" className="text-sm text-accent hover:underline">
                &larr; Back to Worker Dashboard
              </Link>
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              Task Submissions
            </p>
            <h1 className="mt-3 font-display text-4xl tracking-tight">Your Submissions & Appeals</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
              Track the approval status of your completed tasks. If a submission was rejected, you can
              review the reviewer&apos;s reason and submit an appeal with additional context.
            </p>

            <div className="mt-8 space-y-6">
              {submissions.length === 0 ? (
                <Card>
                  <p className="text-sm text-muted">You haven&apos;t submitted proof for any tasks yet.</p>
                  <div className="mt-4">
                    <Link href="/campaigns" className="text-sm font-semibold text-accent hover:underline">
                      Explore Open Campaigns &rarr;
                    </Link>
                  </div>
                </Card>
              ) : (
                submissions.map((sub) => (
                  <Card key={sub.id} className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="rounded-md border border-border px-2.5 py-0.5 text-xs text-accent">
                          {sub.taskPlatform}
                        </span>
                        <h3 className="mt-2 font-display text-xl">{sub.taskTitle}</h3>
                        <p className="text-xs text-muted">Campaign: {sub.campaignTitle}</p>
                      </div>

                      <div className="text-right">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${
                            sub.status === "APPROVED"
                              ? "border-teal/50 bg-teal/10 text-teal"
                              : sub.status === "REJECTED"
                                ? "border-danger/50 bg-danger/10 text-danger"
                                : sub.status === "APPEALED"
                                  ? "border-accent/50 bg-accent/10 text-accent"
                                  : "border-border text-muted"
                          }`}
                        >
                          {sub.status}
                        </span>
                        <p className="mt-2 text-sm font-semibold text-accent">
                          +{sub.rewardPoints} OP
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-background/50 p-4 text-xs space-y-2">
                      <p>
                        <span className="text-muted">Proof URL:</span>{" "}
                        <a
                          href={sub.proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent underline"
                        >
                          {sub.proofUrl}
                        </a>
                      </p>
                      <p>
                        <span className="text-muted">Submitted:</span>{" "}
                        {sub.submittedAt.slice(0, 19).replace("T", " ")}
                      </p>

                      {sub.reviewerNote && sub.status === "APPROVED" ? (
                        <p className="text-teal">
                          <span className="font-semibold">Reviewer Note:</span> {sub.reviewerNote}
                        </p>
                      ) : null}

                      {sub.rejectionReason && (sub.status === "REJECTED" || sub.status === "APPEALED") ? (
                        <div className="rounded border border-danger/30 bg-danger/5 p-3 text-xs">
                          <p className="font-semibold text-danger">Rejection Reason:</p>
                          <p className="mt-1 text-foreground">{sub.rejectionReason}</p>
                        </div>
                      ) : null}

                      {sub.appealReason ? (
                        <div className="rounded border border-accent/30 bg-accent/5 p-3 text-xs">
                          <p className="font-semibold text-accent">Your Appeal:</p>
                          <p className="mt-1 text-foreground">{sub.appealReason}</p>
                          {sub.appealReviewNote ? (
                            <p className="mt-2 border-t border-border/50 pt-2 text-muted">
                              Moderator Decision Note: {sub.appealReviewNote}
                            </p>
                          ) : (
                            <p className="mt-2 text-xs italic text-muted">Awaiting moderator decision</p>
                          )}
                        </div>
                      ) : null}
                    </div>

                    {sub.status === "REJECTED" ? (
                      <div className="border-t border-border pt-4">
                        <h4 className="text-sm font-semibold text-foreground">Appeal this Rejection</h4>
                        <p className="mt-1 text-xs text-muted">
                          If your proof was wrongly rejected, submit an appeal for moderator re-evaluation.
                        </p>
                        <div className="mt-3">
                          <AppealSubmissionForm submissionId={sub.id} />
                        </div>
                      </div>
                    ) : null}
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
