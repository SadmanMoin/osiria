import type { Metadata } from "next";
import { Protected } from "@/components/auth/Protected";
import { WorkerEligibilityForm } from "@/components/eligibility/EligibilityForms";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { getEligibilityStore } from "@/lib/eligibility/prisma-store";
import {
  ELIGIBILITY_PLATFORMS,
  canonicalDisplayName,
  formatAudienceCount,
  formatCreatedOn,
} from "@/lib/eligibility/rules";
import { listPlatformRules } from "@/lib/eligibility/service";

export const metadata: Metadata = {
  title: "Eligibility",
  robots: { index: false, follow: false },
};

const statusLabel = {
  PENDING_VERIFICATION: "Pending verification",
  MANUAL_REVIEW: "Manual review",
  ELIGIBLE: "Eligible",
  INELIGIBLE: "Ineligible",
} as const;

export default function WorkerEligibilityPage() {
  return (
    <Protected area="worker" loginNext="/worker/eligibility">
      {async (user) => {
        const store = getEligibilityStore();
        const rules = await listPlatformRules(store);
        const checks = await Promise.all(
          ELIGIBILITY_PLATFORMS.map(async (platform) => ({
            platform,
            check: user.role === "WORKER" ? await store.findCheck(user.id, platform) : null,
          })),
        );
        return (
          <Container className="py-16">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Worker</p>
            <h1 className="mt-3 font-display text-4xl tracking-tight">Social eligibility</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
              Submit the handle you use on X, Facebook, or Instagram. Osiria does not call those
              platforms. Until profile data is supplied by a real source, the check stays in manual
              review and no follower or friend count is invented.
            </p>
            <div className="mt-8 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <Card>
                <h2 className="font-display text-2xl">Check a handle</h2>
                {user.role === "WORKER" ? (
                  <div className="mt-6">
                    <WorkerEligibilityForm />
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-muted">
                    Only a worker account can submit a handle. Admins review the queue instead.
                  </p>
                )}
              </Card>
              <div className="space-y-4">
                {checks.map(({ platform, check }) => {
                  const rule = rules.find((item) => item.platform === platform);
                  return (
                    <Card key={platform}>
                      <h2 className="font-display text-2xl">{canonicalDisplayName(platform)}</h2>
                      {check ? (
                        <>
                          <p className="mt-2 text-sm text-accent">{statusLabel[check.status]}</p>
                          <p className="mt-2 text-sm">@{check.handle}</p>
                          <p className="mt-2 text-sm text-muted">
                            Created {formatCreatedOn(check.accountCreatedOn)} ·{" "}
                            {formatAudienceCount(check.audienceCount, rule?.audienceMetric ?? "FOLLOWERS")}
                          </p>
                          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
                            {check.reasons.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <p className="mt-2 text-sm text-muted">
                          Waiting for verification. No profile data has been recorded.
                        </p>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          </Container>
        );
      }}
    </Protected>
  );
}
