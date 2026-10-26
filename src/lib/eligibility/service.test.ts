import { describe, expect, it } from "vitest";
import { MemoryEligibilityStore } from "@/lib/eligibility/memory-store";
import {
  decideReview,
  listEligibilityAuditLogs,
  listManualReviews,
  listPlatformRules,
  savePlatformRules,
  submitEligibilityCheck,
  unconfiguredProfileSource,
} from "@/lib/eligibility/service";

describe("Eligibility Service", () => {
  const admin = { id: "admin-1", role: "ADMIN" as const };
  const worker1 = { id: "worker-1", role: "WORKER" as const };
  const worker2 = { id: "worker-2", role: "WORKER" as const };

  it("lists defaults and allows admin to update thresholds with audit logging", async () => {
    const store = new MemoryEligibilityStore();
    const defaults = await listPlatformRules(store);
    expect(defaults).toHaveLength(3);

    const updateResult = await savePlatformRules(
      admin,
      {
        platform: "FACEBOOK",
        isEnabled: true,
        accountCreatedOnOrBefore: null,
        minAudience: 100,
        ruleJoin: "AND",
        audienceMetric: "FRIENDS",
      },
      store,
    );
    expect(updateResult.ok).toBe(true);

    const updated = await listPlatformRules(store);
    const fb = updated.find((r) => r.platform === "FACEBOOK");
    expect(fb?.minAudience).toBe(100);

    // Verify audit log
    const logs = await listEligibilityAuditLogs(store);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      action: "eligibility.settings.update",
      actorUserId: admin.id,
      entityType: "SocialPlatformSetting",
    });
    expect(logs[0].metadata).toHaveProperty("before");
    expect(logs[0].metadata).toHaveProperty("after");
  });

  it("submits worker eligibility and never invents verification data when API is unavailable", async () => {
    const store = new MemoryEligibilityStore();
    const result = await submitEligibilityCheck(
      worker1,
      { platform: "X", handle: "cryptodev" },
      store,
      unconfiguredProfileSource,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.check.status).toBe("MANUAL_REVIEW");
    expect(result.check.evidenceAvailability).toBe("unavailable");
    expect(result.check.accountCreatedOn).toBeNull();
    expect(result.check.audienceCount).toBeNull();
    expect(result.check.reasons).toContain(
      "X profile data is unavailable. Manual review is required.",
    );
    expect(result.check.reasons).toContain(
      "No creation date or audience count was inferred.",
    );

    // Appears in manual review list
    const open = await listManualReviews(store);
    expect(open).toHaveLength(1);
    expect(open[0].handle).toBe("cryptodev");
  });

  it("handles admin manual review decisions with audit logs without fabricating profile metrics", async () => {
    const store = new MemoryEligibilityStore();
    // Worker submits
    await submitEligibilityCheck(
      worker1,
      { platform: "INSTAGRAM", handle: "instauser" },
      store,
      unconfiguredProfileSource,
    );

    // Reject short review notes
    const shortNote = await decideReview(
      admin,
      {
        userId: worker1.id,
        platform: "INSTAGRAM",
        decision: "approve",
        note: "too short",
      },
      store,
    );
    expect(shortNote).toMatchObject({ ok: false, status: 400 });

    // Approve with detailed note
    const approved = await decideReview(
      admin,
      {
        userId: worker1.id,
        platform: "INSTAGRAM",
        decision: "approve",
        note: "Verified account identity via manual documentation.",
      },
      store,
    );
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;

    expect(approved.check.status).toBe("ELIGIBLE");
    expect(approved.check.decisionSource).toBe("ADMIN");
    expect(approved.check.reviewNote).toBe(
      "Verified account identity via manual documentation.",
    );
    // Profile metrics remain null — never invented!
    expect(approved.check.accountCreatedOn).toBeNull();
    expect(approved.check.audienceCount).toBeNull();
    expect(approved.check.reasons[0]).toContain(
      "Instagram was approved by an admin. No creation date or audience count was added.",
    );

    // No longer in open reviews
    const openAfter = await listManualReviews(store);
    expect(openAfter).toHaveLength(0);

    // Audit logs recorded
    const logs = await listEligibilityAuditLogs(store);
    const reviewLog = logs.find((l) => l.action === "eligibility.review.approve");
    expect(reviewLog).toBeDefined();
    expect(reviewLog?.actorUserId).toBe(admin.id);
    expect(reviewLog?.metadata).toMatchObject({
      platform: "INSTAGRAM",
      decision: "approve",
      metricsAdded: false,
    });
  });

  it("prevents workers from claiming a handle already linked by another user", async () => {
    const store = new MemoryEligibilityStore();
    // Worker 1 links @popularhandle
    const res1 = await submitEligibilityCheck(
      worker1,
      { platform: "X", handle: "popularhandle" },
      store,
      unconfiguredProfileSource,
    );
    expect(res1.ok).toBe(true);

    // Worker 2 tries to link @popularhandle on X
    const res2 = await submitEligibilityCheck(
      worker2,
      { platform: "X", handle: "popularhandle" },
      store,
      unconfiguredProfileSource,
    );
    expect(res2).toMatchObject({
      ok: false,
      status: 409,
      message: "That handle is already linked to another account.",
    });

    // Worker 1 can re-submit their own handle
    const res1Again = await submitEligibilityCheck(
      worker1,
      { platform: "X", handle: "popularhandle" },
      store,
      unconfiguredProfileSource,
    );
    expect(res1Again.ok).toBe(true);

    // Worker 2 can link @popularhandle on FACEBOOK (different platform)
    const res2Fb = await submitEligibilityCheck(
      worker2,
      { platform: "FACEBOOK", handle: "popularhandle" },
      store,
      unconfiguredProfileSource,
    );
    expect(res2Fb.ok).toBe(true);
  });

  it("protects admin review decisions from being overwritten by worker resubmissions", async () => {
    const store = new MemoryEligibilityStore();
    // Worker submits
    await submitEligibilityCheck(
      worker1,
      { platform: "X", handle: "revieweduser" },
      store,
      unconfiguredProfileSource,
    );

    // Admin rejects with note
    await decideReview(
      admin,
      {
        userId: worker1.id,
        platform: "X",
        decision: "reject",
        note: "Suspected duplicate account flagged in review.",
      },
      store,
    );

    // Worker re-submits the handle
    const resubmit = await submitEligibilityCheck(
      worker1,
      { platform: "X", handle: "revieweduser" },
      store,
      unconfiguredProfileSource,
    );
    expect(resubmit.ok).toBe(true);
    if (!resubmit.ok) return;

    expect(resubmit.check.status).toBe("INELIGIBLE");
    expect(resubmit.check.decisionSource).toBe("ADMIN");
    expect(resubmit.message).toContain(
      "An admin already reviewed this account. The stored decision was left unchanged.",
    );
  });
});
