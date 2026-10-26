import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  campaign: { findUnique: vi.fn() },
  payment: { findUnique: vi.fn() },
  campaignBudgetLedger: { aggregate: vi.fn(), create: vi.fn() },
  taskSubmission: { findUnique: vi.fn(), update: vi.fn() },
  fraudEvent: { findUnique: vi.fn(), update: vi.fn() },
  adminAuditLog: { create: vi.fn() },
  socialEligibility: { findUnique: vi.fn() },
  socialAccount: { findFirst: vi.fn(), upsert: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ getPrisma: () => db }));
import { PrismaCampaignStore } from "@/lib/campaigns/prisma-store";
import { PrismaEligibilityStore } from "@/lib/eligibility/prisma-store";

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async (fn) => fn(db));
  db.campaign.findUnique.mockResolvedValue({ id: "campaign", ownerId: "owner", currency: "USD", budgetMinor: 1000 });
  db.payment.findUnique.mockResolvedValue({ id: "payment", userId: "owner", currency: "USD", status: "COMPLETED", amountMinor: 1000 });
  db.campaignBudgetLedger.aggregate.mockResolvedValue({ _sum: { amountMinor: 0 } });
});

describe("Prisma security transaction contracts (mocked database)", () => {
  it("preserves an admin eligibility decision committed after the service read", async () => {
    db.socialEligibility.findUnique.mockResolvedValue({
      id: "check", userId: "worker", platform: "X", status: "ELIGIBLE", reasons: ["Admin approved"],
      decisionSource: "ADMIN", accountCreatedOn: null, audienceCount: null, evidenceAvailability: "UNAVAILABLE",
      reviewNote: "Evidence reviewed", reviewedById: "admin", socialAccountId: "social",
      user: { displayName: "Worker", email: "worker@example.test" }, socialAccount: { handle: "original" },
    });
    const result = await new PrismaEligibilityStore().saveCheck({
      userId: "worker", platform: "X", handle: "changed", displayName: null, email: null,
      status: "MANUAL_REVIEW", reasons: ["Unavailable"], accountCreatedOn: null, audienceCount: null,
      evidenceAvailability: "unavailable", markVerified: false,
    });
    expect(result).toMatchObject({ decisionSource: "ADMIN", handle: "original", status: "ELIGIBLE" });
    expect(db.socialAccount.upsert).not.toHaveBeenCalled();
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("refuses unbacked funding before opening a database transaction", async () => {
    await expect(new PrismaCampaignStore().fundCampaign({ campaignId: "campaign", amountMinor: 100 })).rejects.toThrow("verified settled payment");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    { status: "PENDING", userId: "owner", currency: "USD" },
    { status: "COMPLETED", userId: "attacker", currency: "USD" },
    { status: "COMPLETED", userId: "owner", currency: "EUR" },
  ])("refuses unsettled, foreign-owned, or wrong-currency payments: %o", async (payment) => {
    db.payment.findUnique.mockResolvedValue({ id: "payment", amountMinor: 1000, ...payment });
    await expect(new PrismaCampaignStore().fundCampaign({ campaignId: "campaign", amountMinor: 100, paymentId: "payment" })).rejects.toThrow("settled");
    expect(db.campaignBudgetLedger.create).not.toHaveBeenCalled();
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("refuses to allocate a settled payment more than once beyond its amount", async () => {
    db.campaignBudgetLedger.aggregate.mockResolvedValueOnce({ _sum: { amountMinor: 950 } });
    await expect(new PrismaCampaignStore().fundCampaign({ campaignId: "campaign", amountMinor: 100, paymentId: "payment" })).rejects.toThrow("insufficient");
    expect(db.campaignBudgetLedger.create).not.toHaveBeenCalled();
  });

  it("enforces the campaign cap independently of remaining payment credit", async () => {
    db.campaignBudgetLedger.aggregate.mockResolvedValueOnce({ _sum: { amountMinor: 0 } }).mockResolvedValueOnce({ _sum: { amountMinor: 950 } });
    await expect(new PrismaCampaignStore().fundCampaign({ campaignId: "campaign", amountMinor: 100, paymentId: "payment" })).rejects.toThrow("insufficient");
    expect(db.campaignBudgetLedger.create).not.toHaveBeenCalled();
  });

  it.each(["FLAGGED", "APPEALED", "APPROVED"])("does not approve %s submissions through ordinary review", async (status) => {
    db.taskSubmission.findUnique.mockResolvedValue({ id: "submission", status });
    await expect(new PrismaCampaignStore().reviewSubmission({ submissionId: "submission", reviewerId: "owner", decision: "approve" })).rejects.toThrow("already");
    expect(db.taskSubmission.update).not.toHaveBeenCalled();
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("does not resolve an old event against a rewarded submission", async () => {
    db.fraudEvent.findUnique.mockResolvedValue({ id: "event", resolvedAt: null, submission: { status: "APPROVED" } });
    await expect(new PrismaCampaignStore().resolveFraudEvent("event", "CONFIRM", "admin", "Verified evidence")).rejects.toThrow("no longer flagged");
    expect(db.taskSubmission.update).not.toHaveBeenCalled();
    expect(db.fraudEvent.update).not.toHaveBeenCalled();
  });

  it("propagates audit failure within the same transaction", async () => {
    db.fraudEvent.findUnique.mockResolvedValue({ id: "event", resolvedAt: null, submissionId: null, submission: null });
    db.adminAuditLog.create.mockRejectedValue(new Error("audit unavailable"));
    await expect(new PrismaCampaignStore().resolveFraudEvent("event", "DISMISS", "admin", "Reviewed evidence")).rejects.toThrow("audit unavailable");
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });
});
