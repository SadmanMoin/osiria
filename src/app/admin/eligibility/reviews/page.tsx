import type { Metadata } from "next";
import Link from "next/link";
import { Protected } from "@/components/auth/Protected";
import { ReviewDecisionForm } from "@/components/eligibility/EligibilityForms";
import { Container } from "@/components/ui/Container";
import { getEligibilityStore } from "@/lib/eligibility/prisma-store";
import {
  canonicalDisplayName,
  formatAudienceCount,
  formatCreatedOn,
  type AudienceMetric,
  type EligibilityPlatform,
} from "@/lib/eligibility/rules";
import { listManualReviews, listPlatformRules } from "@/lib/eligibility/service";

export const metadata: Metadata = {
  title: "Eligibility reviews",
  robots: { index: false, follow: false },
};

const statusLabel = {
  PENDING_VERIFICATION: "Pending verification",
  MANUAL_REVIEW: "Manual review",
  ELIGIBLE: "Eligible",
  INELIGIBLE: "Ineligible",
} as const;

export default function EligibilityReviewsPage() {
  return (
    <Protected area="admin" loginNext="/admin/eligibility/reviews">
      {async () => {
        const store = getEligibilityStore();
        const [rules, reviews] = await Promise.all([
          listPlatformRules(store),
          listManualReviews(store),
        ]);
        const metrics = new Map<EligibilityPlatform, AudienceMetric>(
          rules.map((rule) => [rule.platform, rule.audienceMetric]),
        );
        return (
          <Container className="py-16">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Admin</p>
            <h1 className="mt-3 font-display text-4xl tracking-tight">Manual review</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
              Pending means no profile data was recorded. Manual review means the platform data
              was unavailable or incomplete. Approving an account does not add a creation date or
              an audience count.
            </p>
            <p className="mt-4 text-sm">
              <Link href="/admin/eligibility" className="text-accent hover:underline">
                Edit thresholds
              </Link>
            </p>
            <div className="mt-8 space-y-5">
              {reviews.length === 0 ? (
                <p className="text-sm text-muted">No accounts are waiting.</p>
              ) : (
                reviews.map((review) => {
                  const metric = metrics.get(review.platform) ?? "FOLLOWERS";
                  return (
                    <article
                      key={review.id}
                      className="rounded-2xl border border-border bg-surface p-6"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <h2 className="font-display text-2xl">
                          {canonicalDisplayName(review.platform)} · {review.handle ?? "No handle"}
                        </h2>
                        <p className="text-sm text-accent">{statusLabel[review.status]}</p>
                      </div>
                      <p className="mt-2 text-sm text-muted">
                        {review.displayName ?? "Account"} · {review.email ?? review.userId}
                      </p>
                      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-muted">Account created</dt>
                          <dd>{formatCreatedOn(review.accountCreatedOn)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted">Audience</dt>
                          <dd>{formatAudienceCount(review.audienceCount, metric)}</dd>
                        </div>
                      </dl>
                      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
                        {review.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                      <div className="mt-6 max-w-xl">
                        <ReviewDecisionForm userId={review.userId} platform={review.platform} />
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </Container>
        );
      }}
    </Protected>
  );
}
