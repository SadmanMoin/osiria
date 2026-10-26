import type { Metadata } from "next";
import Link from "next/link";
import { DecideAppealForm, ReviewSubmissionForm } from "@/components/campaigns/CampaignForms";
import { Protected } from "@/components/auth/Protected";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { getCampaignStore } from "@/lib/campaigns/prisma-store";
import type { StoredSubmission } from "@/lib/campaigns/types";

export const metadata: Metadata = {
  title: "Submissions & Appeals",
  robots: { index: false, follow: false },
};

export default function AdminSubmissionsPage() {
  return (
    <Protected area="admin" loginNext="/admin/submissions">
      {async () => {
        const store = getCampaignStore();
        let submissions: StoredSubmission[] = [];
        try {
          submissions = await store.listSubmissions();
        } catch {
          submissions = [];
        }

        const appeals = submissions.filter((s) => s.status === "APPEALED");
        const pending = submissions.filter((s) => s.status === "PENDING");
        const closed = submissions.filter((s) => s.status === "APPROVED" || s.status === "REJECTED");

        return (
          <Container className="py-16">
            <div className="mb-4">
              <Link href="/admin" className="text-sm text-accent hover:underline">
                &larr; Back to Admin Operations
              </Link>
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Admin</p>
            <h1 className="mt-3 font-display text-4xl tracking-tight">Submissions & Appeal Queue</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
              Oversee task submissions, resolve worker appeals, and protect against fraud or invalid
              proof claims.
            </p>

            <div className="mt-10 space-y-10">
              {/* Appeals Section */}
              <div>
                <h2 className="font-display text-2xl tracking-tight text-accent">
                  Active Appeals ({appeals.length})
                </h2>
                <p className="text-sm text-muted">
                  Workers who appealed an advertiser rejection. Overturning an appeal awards points and
                  debits campaign budget. Upholding keeps the submission rejected.
                </p>

                {appeals.length === 0 ? (
                  <Card className="mt-4">
                    <p className="text-sm text-muted">No appeals in the queue.</p>
                  </Card>
                ) : (
                  <div className="mt-4 grid gap-6 md:grid-cols-2">
                    {appeals.map((sub) => (
                      <Card key={sub.id} className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-semibold uppercase text-accent">
                            APPEALED
                          </span>
                          <span className="text-xs text-muted">
                            Reward: {sub.rewardPoints} OP (${(sub.rewardAmountMinor / 100).toFixed(2)})
                          </span>
                        </div>

                        <div>
                          <h3 className="font-display text-xl">{sub.taskTitle}</h3>
                          <p className="text-xs text-muted">Campaign: {sub.campaignTitle}</p>
                          <p className="text-xs text-muted">
                            Worker: {sub.userDisplayName} (@{sub.socialHandle})
                          </p>
                        </div>

                        <div className="rounded-lg border border-border/80 bg-background/50 p-3 text-xs space-y-2">
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
                          <p className="text-danger">
                            <span className="font-semibold">Original Rejection Reason:</span>{" "}
                            {sub.rejectionReason}
                          </p>
                          <div className="rounded border border-accent/40 bg-accent/10 p-2">
                            <p className="font-semibold text-accent">Worker Appeal Statement:</p>
                            <p className="text-foreground">{sub.appealReason}</p>
                          </div>
                        </div>

                        <div className="border-t border-border pt-4">
                          <DecideAppealForm submissionId={sub.id} />
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending Submissions */}
              <div className="border-t border-border pt-8">
                <h2 className="font-display text-2xl tracking-tight">
                  Pending Submissions ({pending.length})
                </h2>
                {pending.length === 0 ? (
                  <Card className="mt-4">
                    <p className="text-sm text-muted">No unreviewed submissions.</p>
                  </Card>
                ) : (
                  <div className="mt-4 grid gap-6 md:grid-cols-2">
                    {pending.map((sub) => (
                      <Card key={sub.id} className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-accent">{sub.taskPlatform}</span>
                          <span className="font-semibold text-teal">{sub.rewardPoints} OP</span>
                        </div>
                        <h3 className="font-display text-lg">{sub.taskTitle}</h3>
                        <p className="text-xs text-muted">
                          Worker: {sub.userDisplayName} (@{sub.socialHandle}) · Campaign: {sub.campaignTitle}
                        </p>
                        <p className="truncate text-xs">
                          Proof:{" "}
                          <a
                            href={sub.proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent underline"
                          >
                            {sub.proofUrl}
                          </a>
                        </p>
                        <div className="border-t border-border pt-2">
                          <ReviewSubmissionForm submissionId={sub.id} />
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Closed Submissions Summary */}
              {closed.length > 0 ? (
                <div className="border-t border-border pt-8">
                  <h2 className="font-display text-2xl tracking-tight">
                    Resolved Submissions ({closed.length})
                  </h2>
                  <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
                    <table className="w-full min-w-[36rem] text-left text-sm">
                      <thead className="border-b border-border text-muted">
                        <tr>
                          <th className="px-4 py-3 font-medium">Task</th>
                          <th className="px-4 py-3 font-medium">Worker</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Notes / Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {closed.map((s) => (
                          <tr key={s.id} className="border-b border-border last:border-0">
                            <td className="px-4 py-3 font-medium">{s.taskTitle}</td>
                            <td className="px-4 py-3 text-muted">@{s.socialHandle}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-xs font-semibold ${
                                  s.status === "APPROVED" ? "text-teal" : "text-danger"
                                }`}
                              >
                                {s.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted">
                              {s.rejectionReason ?? s.reviewerNote ?? s.appealReviewNote ?? "—"}
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
