import type { Metadata } from "next";
import Link from "next/link";
import { ReviewSubmissionForm } from "@/components/campaigns/CampaignForms";
import { Protected } from "@/components/auth/Protected";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { getCampaignStore } from "@/lib/campaigns/prisma-store";
import type { StoredSubmission } from "@/lib/campaigns/types";

export const metadata: Metadata = {
  title: "Review Submissions",
  robots: { index: false, follow: false },
};

export default function AdvertiserReviewsPage() {
  return (
    <Protected area="advertiser" loginNext="/advertiser/reviews">
      {async (user) => {
        const store = getCampaignStore();
        let submissions: StoredSubmission[] = [];
        try {
          submissions = await store.listSubmissions({ ownerId: user.id });
        } catch {
          submissions = [];
        }

        const pending = submissions.filter((s) => s.status === "PENDING" || s.status === "APPEALED");
        const reviewed = submissions.filter((s) => s.status === "APPROVED" || s.status === "REJECTED");

        return (
          <Container className="py-16">
            <div className="mb-4">
              <Link href="/advertiser" className="text-sm text-accent hover:underline">
                &larr; Back to Advertiser Dashboard
              </Link>
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              Submission Review Queue
            </p>
            <h1 className="mt-3 font-display text-4xl tracking-tight">Review Worker Proofs</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
              Examine the submitted proof URL before approving rewards. Approval executes an atomic
              transaction that decrements the campaign budget and credits the worker&apos;s OP balance.
              Rejections require a specific failure reason and can be appealed by the worker.
            </p>

            <div className="mt-10 space-y-8">
              <div>
                <h2 className="font-display text-2xl tracking-tight">
                  Awaiting Review ({pending.length})
                </h2>
                {pending.length === 0 ? (
                  <Card className="mt-4">
                    <p className="text-sm text-muted">No pending submissions in your queue.</p>
                  </Card>
                ) : (
                  <div className="mt-4 grid gap-6 md:grid-cols-2">
                    {pending.map((sub) => (
                      <Card key={sub.id} className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="rounded-md border border-border px-2 py-0.5 text-xs text-accent">
                            {sub.taskPlatform} · {sub.rewardPoints} OP (${(sub.rewardAmountMinor / 100).toFixed(2)})
                          </span>
                          <span className="text-xs font-medium uppercase text-teal">
                            {sub.status}
                          </span>
                        </div>

                        <div>
                          <h3 className="font-display text-xl">{sub.taskTitle}</h3>
                          <p className="text-xs text-muted">Campaign: {sub.campaignTitle}</p>
                        </div>

                        <div className="rounded-lg border border-border/80 bg-background/50 p-3 text-xs space-y-1">
                          <p>
                            <span className="text-muted">Worker:</span> {sub.userDisplayName} (
                            <span className="text-accent">@{sub.socialHandle}</span>)
                          </p>
                          <p>
                            <span className="text-muted">Submitted:</span> {sub.submittedAt.slice(0, 19).replace("T", " ")}
                          </p>
                          <p className="truncate">
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
                          {sub.appealReason ? (
                            <div className="mt-2 rounded border border-accent/40 bg-accent/10 p-2">
                              <p className="font-semibold text-accent">Worker Appeal:</p>
                              <p className="text-foreground">{sub.appealReason}</p>
                            </div>
                          ) : null}
                        </div>

                        <div className="border-t border-border pt-3">
                          <ReviewSubmissionForm submissionId={sub.id} />
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {reviewed.length > 0 ? (
                <div className="border-t border-border pt-8">
                  <h2 className="font-display text-2xl tracking-tight">
                    Completed Reviews ({reviewed.length})
                  </h2>
                  <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
                    <table className="w-full min-w-[36rem] text-left text-sm">
                      <thead className="border-b border-border text-muted">
                        <tr>
                          <th className="px-4 py-3 font-medium">Task</th>
                          <th className="px-4 py-3 font-medium">Worker</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Outcome Note / Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewed.map((r) => (
                          <tr key={r.id} className="border-b border-border last:border-0">
                            <td className="px-4 py-3 font-medium">{r.taskTitle}</td>
                            <td className="px-4 py-3 text-muted">@{r.socialHandle}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-xs font-semibold ${
                                  r.status === "APPROVED" ? "text-teal" : "text-danger"
                                }`}
                              >
                                {r.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted">
                              {r.rejectionReason ?? r.reviewerNote ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          </Container>
        );
      }}
    </Protected>
  );
}
