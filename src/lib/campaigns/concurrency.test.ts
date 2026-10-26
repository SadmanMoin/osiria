import { describe, expect, it } from "vitest";
import { MemoryCampaignStore } from "@/lib/campaigns/memory-store";
import { InsufficientBudgetError, InvalidStateError } from "@/lib/campaigns/store";

describe("Concurrent Approvals & Idempotency", () => {
  function setupStore() {
    const store = new MemoryCampaignStore();
    store.registerUser({ id: "adv-1", displayName: "Advertiser", email: "adv@example.com" });
    store.registerUser({ id: "worker-1", displayName: "Worker 1", email: "w1@example.com" });
    store.registerUser({ id: "worker-2", displayName: "Worker 2", email: "w2@example.com" });

    store.registerSocialAccount({ id: "soc-1", userId: "worker-1", platform: "X", handle: "w1_x", status: "ACTIVE" });
    store.registerSocialAccount({ id: "soc-2", userId: "worker-2", platform: "X", handle: "w2_x", status: "ACTIVE" });

    return store;
  }

  it("prevents double-rewarding when the same submission is approved concurrently", async () => {
    const store = setupStore();

    const campaign = await store.createCampaign({
      ownerId: "adv-1",
      title: "Concurrent Single Submission",
      slug: "concurrent-single",
      description: "Test double approval",
      budgetMinor: 1000,
      tasks: [
        {
          platform: "X",
          title: "Tweet support",
          instructions: "Post tweet",
          rewardPoints: 100,
          rewardAmountMinor: 50,
          slotsTotal: 10,
        },
      ],
    });

    await store.fundCampaign({ campaignId: campaign.id, amountMinor: 500 });
    await store.moderateCampaign({ campaignId: campaign.id, moderatorId: "admin-1", action: "approve" });

    const sub = await store.createSubmission(
      { taskId: campaign.tasks[0].id, userId: "worker-1", proofUrl: "https://x.com/w1_x/status/1" },
      "soc-1",
    );

    // Run two approvals concurrently
    const [result1, result2] = await Promise.allSettled([
      store.reviewSubmission({ submissionId: sub.id, reviewerId: "adv-1", decision: "approve" }),
      store.reviewSubmission({ submissionId: sub.id, reviewerId: "adv-1", decision: "approve" }),
    ]);

    // One must fulfill and the other must reject
    const fulfilled = [result1, result2].filter((r) => r.status === "fulfilled");
    const rejected = [result1, result2].filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(InvalidStateError);

    // Verify exactly one points ledger reward exists
    const pointsEntries = store.pointsEntries.filter((p) => p.submissionId === sub.id);
    expect(pointsEntries).toHaveLength(1);

    // Verify worker balance is exactly 100 OP (not 200 OP)
    const points = await store.getWorkerPointsSummary("worker-1");
    expect(points.currentBalance).toBe(100);

    // Verify budget deducted exactly once (50 cents)
    const budget = await store.getCampaignBudgetSummary(campaign.id);
    expect(budget.totalPaidMinor).toBe(50);
    expect(budget.availableBudgetMinor).toBe(450);

    // Verify slots incremented only once
    const task = await store.findTaskById(campaign.tasks[0].id);
    expect(task?.slotsFilled).toBe(1);
  });

  it("prevents overspending when concurrent approvals exceed available budget", async () => {
    const store = setupStore();

    const campaign = await store.createCampaign({
      ownerId: "adv-1",
      title: "Budget Race Condition",
      slug: "budget-race",
      description: "Test concurrent budget exhaustion",
      budgetMinor: 1000,
      tasks: [
        {
          platform: "X",
          title: "Follow and post",
          instructions: "Follow account",
          rewardPoints: 100,
          rewardAmountMinor: 100, // each payout requires 100 cents
          slotsTotal: 10,
        },
      ],
    });

    // Fund ONLY 100 cents (enough for exactly ONE approval)
    await store.fundCampaign({ campaignId: campaign.id, amountMinor: 100 });
    await store.moderateCampaign({ campaignId: campaign.id, moderatorId: "admin-1", action: "approve" });

    // Worker 1 and Worker 2 both submit
    const sub1 = await store.createSubmission(
      { taskId: campaign.tasks[0].id, userId: "worker-1", proofUrl: "https://x.com/w1_x/status/1" },
      "soc-1",
    );
    const sub2 = await store.createSubmission(
      { taskId: campaign.tasks[0].id, userId: "worker-2", proofUrl: "https://x.com/w2_x/status/2" },
      "soc-2",
    );

    // Attempt to approve both submissions concurrently
    const [result1, result2] = await Promise.allSettled([
      store.reviewSubmission({ submissionId: sub1.id, reviewerId: "adv-1", decision: "approve" }),
      store.reviewSubmission({ submissionId: sub2.id, reviewerId: "adv-1", decision: "approve" }),
    ]);

    const fulfilled = [result1, result2].filter((r) => r.status === "fulfilled");
    const rejected = [result1, result2].filter((r) => r.status === "rejected");

    // Exactly one could be funded, the other must fail with InsufficientBudgetError
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientBudgetError);

    // Total budget available is now 0, paid is 100, never negative!
    const budget = await store.getCampaignBudgetSummary(campaign.id);
    expect(budget.availableBudgetMinor).toBe(0);
    expect(budget.totalPaidMinor).toBe(100);

    // Exactly one worker got 100 OP, total OP awarded across all workers is 100 OP
    const w1Points = await store.getWorkerPointsSummary("worker-1");
    const w2Points = await store.getWorkerPointsSummary("worker-2");
    expect(w1Points.currentBalance + w2Points.currentBalance).toBe(100);
  });
});
