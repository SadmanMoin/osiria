import type { Metadata } from "next";
import Link from "next/link";
import { Protected } from "@/components/auth/Protected";
import { DatabaseUnavailable } from "@/components/auth/DatabaseUnavailable";
import { ResolveFraudForm } from "@/components/campaigns/FraudForms";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { getCampaignStore } from "@/lib/campaigns/prisma-store";
import type { StoredSubmission } from "@/lib/campaigns/types";
import type { StoredFraudEvent } from "@/lib/security/types";

export const metadata: Metadata = {
  title: "Fraud & Security Oversight",
  robots: { index: false, follow: false },
};

export default function AdminFraudPage() {
  return (
    <Protected area="admin" loginNext="/admin/fraud">
      {async () => {
        const store = getCampaignStore();
        let events: StoredFraudEvent[] = [];
        let flaggedSubmissions: StoredSubmission[] = [];

        try {
          [events, flaggedSubmissions] = await Promise.all([
            store.listFraudEvents(),
            store.listSubmissions({ status: "FLAGGED" }),
          ]);
        } catch {
          return <DatabaseUnavailable />;
        }

        const criticalCount = events.filter((e) => e.severity === "CRITICAL").length; // eslint-disable-line @typescript-eslint/no-unused-vars
        const velocityCount = events.filter((e) => e.type === "VELOCITY").length;
        const duplicateCount = events.filter((e) => e.type === "DUPLICATE_SUBMISSION").length;

        return (
          <Container className="py-16">
            <div className="mb-4">
              <Link href="/admin" className="text-sm text-accent hover:underline">
                &larr; Back to Admin Operations
              </Link>
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Security</p>
            <h1 className="mt-3 font-display text-4xl tracking-tight">Fraud Detection & Security Flags</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
              Real-time heuristic monitoring for duplicate proof submissions, cross-account proof reuse,
              high submission velocity, and account handle mismatches. Flagged submissions are quarantined
              from advertiser review until evaluated by an administrator.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-4">
              <Card>
                <p className="text-sm text-muted">Total Fraud Events</p>
                <p className="mt-2 font-display text-3xl">{events.length}</p>
              </Card>
              <Card>
                <p className="text-sm text-muted">Flagged Submissions</p>
                <p className="mt-2 font-display text-3xl text-amber-400">{flaggedSubmissions.length}</p>
              </Card>
              <Card>
                <p className="text-sm text-muted">Duplicate Proof Flags</p>
                <p className="mt-2 font-display text-3xl text-red-400">{duplicateCount}</p>
              </Card>
              <Card>
                <p className="text-sm text-muted">Velocity Spikes</p>
                <p className="mt-2 font-display text-3xl">{velocityCount}</p>
              </Card>
            </div>

            {/* Flagged Submissions Section */}
            <div className="mt-12">
              <h2 className="font-display text-2xl tracking-tight">Quarantined Submissions ({flaggedSubmissions.length})</h2>
              <p className="mt-1 text-xs text-muted">
                These submissions cannot be approved or rewarded until reviewed.
              </p>

              {flaggedSubmissions.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
                  No submissions are currently quarantined.
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {flaggedSubmissions.map((sub) => (
                    <Card key={sub.id} className="border-amber-500/40 bg-amber-500/5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400">
                            FLAGGED
                          </span>
                          <span className="ml-2 font-medium">{sub.taskTitle}</span>
                          <span className="ml-2 text-xs text-muted">({sub.campaignTitle})</span>
                        </div>
                        <span className="text-xs text-muted">{new Date(sub.submittedAt).toLocaleString()}</span>
                      </div>

                      <div className="mt-3 text-xs text-muted">
                        <p><strong>Worker:</strong> {sub.userDisplayName} ({sub.userEmail})</p>
                        <p><strong>Linked Handle:</strong> @{sub.socialHandle} on {sub.socialPlatform}</p>
                        <p className="mt-1">
                          <strong>Proof URL:</strong>{" "}
                          <a
                            href={sub.proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent underline break-all"
                          >
                            {sub.proofUrl}
                          </a>
                        </p>
                        {sub.reviewerNote && (
                          <p className="mt-2 text-amber-300">
                            <strong>Detection Reason:</strong> {sub.reviewerNote}
                          </p>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Fraud Events Log */}
            <div className="mt-12">
              <h2 className="font-display text-2xl tracking-tight">Security & Fraud Events ({events.length})</h2>
              {events.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
                  No security fraud events logged yet.
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {events.map((event) => {
                    const isCritical = event.severity === "CRITICAL";
                    const isHigh = event.severity === "HIGH";
                    return (
                      <Card key={event.id} className={isCritical ? "border-red-500/50" : isHigh ? "border-amber-500/50" : ""}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded px-2 py-0.5 text-xs font-semibold ${
                                isCritical
                                  ? "bg-red-500/20 text-red-400"
                                  : isHigh
                                    ? "bg-amber-500/20 text-amber-400"
                                    : "bg-surface text-muted"
                              }`}
                            >
                              {event.severity}
                            </span>
                            <span className="font-medium text-sm">{event.type}</span>
                          </div>
                          <span className="text-xs text-muted">{new Date(event.createdAt).toLocaleString()}</span>
                        </div>

                        <div className="mt-3 text-xs text-muted">
                          {event.userDisplayName && (
                            <p><strong>Worker:</strong> {event.userDisplayName} ({event.userEmail})</p>
                          )}
                          {event.details && (
                            <pre className="mt-2 max-h-36 overflow-auto rounded bg-surface p-2 text-[11px] text-foreground">
                              {JSON.stringify(event.details, null, 2)}
                            </pre>
                          )}
                        </div>

                        {event.resolvedAt ? <p className="mt-4 text-sm text-muted">Resolved: {event.resolution}</p> : <ResolveFraudForm eventId={event.id} severity={event.severity} />}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </Container>
        );
      }}
    </Protected>
  );
}
