import { describe, expect, it } from "vitest";
import { MemoryCampaignStore } from "@/lib/campaigns/memory-store";
import { InsufficientBudgetError } from "@/lib/campaigns/store";

describe("Campaign Budget Tracking & Separate Ledgers", () => {
  function setupStore() {
    const store = new MemoryCampaignStore();
    store.registerUser({ id: "adv-1", displayName: "Alice Advertiser", email: "alice@example.com" });
    store.registerUser({ id: "worker-1", displayName: "Bob Worker", email: "bob@example.com" });
    store.registerUser({ id: "worker-2", displayName: "Charlie Worker", email: "charlie@example.com" });

    store.registerSocialAccount({
      id: "soc-1",
      userId: "worker-1",
      platform: "X",
      handle: "bob_x",
      status: "ACTIVE",
    });
    store.registerSocialAccount({
      id: "soc-2",
      userId: "worker-2",
      platform: "X",
      handle: "charlie_x",
      status: "ACTIVE",
    });

    return store;
  }

  it("keeps advertiser funds, campaign budget, and worker OP balances in separate ledgers", async () => {
    const store = setupStore();

    // 1. Advertiser creates a deposit intent (Advertiser Funds Ledger)
    const deposit = await store.createDepositIntent("adv-1", 10000, "ext-stripe-123");
    expect(deposit.status).toBe("PENDING"); // Never fake payment success!

    let advFunds = await store.getAdvertiserFundsSummary("adv-1");
    expect(advFunds.pendingDepositsMinor).toBe(10000);
    expect(advFunds.totalDepositedMinor).toBe(0);

    // Simulate real completed deposit
    store.payments[0].status = "COMPLETED";
    advFunds = await store.getAdvertiserFundsSummary("adv-1");
    expect(advFunds.totalDepositedMinor).toBe(10000);
    expect(advFunds.availableBalanceMinor).toBe(10000);

    // 2. Advertiser creates a campaign and allocates budget (Campaign Budget Ledger)
    const campaign = await store.createCampaign({
      ownerId: "adv-1",
      title: "Launch Boost",
      slug: "launch-boost",
      description: "Promote our launch",
      budgetMinor: 5000, // $50 cap
      tasks: [
        {
          platform: "X",
          title: "Repost launch announcement",
          instructions: "Repost and like",
          rewardPoints: 200, // 200 OP
          rewardAmountMinor: 100, // $1.00 payout
          slotsTotal: 10,
        },
      ],
    });

    // Fund the campaign with $2.00 (200 cents)
    await store.fundCampaign({
      campaignId: campaign.id,
      amountMinor: 200,
      note: "Initial allocation",
    });

    // Check Campaign Budget Ledger
    const campBudget = await store.getCampaignBudgetSummary(campaign.id);
    expect(campBudget.totalFundedMinor).toBe(200);
    expect(campBudget.totalPaidMinor).toBe(0);
    expect(campBudget.availableBudgetMinor).toBe(200);

    // Check Advertiser Funds ledger reflected allocation
    advFunds = await store.getAdvertiserFundsSummary("adv-1");
    expect(advFunds.totalAllocatedMinor).toBe(200);
    expect(advFunds.availableBalanceMinor).toBe(9800);

    // Check Worker OP Balance ledger before any submission (isolated)
    let workerPoints = await store.getWorkerPointsSummary("worker-1");
    expect(workerPoints.currentBalance).toBe(0);
    expect(workerPoints.totalEarned).toBe(0);

    // Open campaign & task
    await store.moderateCampaign({
      campaignId: campaign.id,
      moderatorId: "admin-1",
      action: "approve",
    });

    // 3. Worker 1 submits and gets approved
    const sub1 = await store.createSubmission(
      { taskId: campaign.tasks[0].id, userId: "worker-1", proofUrl: "https://x.com/bob_x/status/1" },
      "soc-1",
    );
    await store.reviewSubmission({
      submissionId: sub1.id,
      reviewerId: "adv-1",
      decision: "approve",
      note: "Great repost",
    });

    // Verify Campaign Budget Ledger decremented by 100 cents
    const budgetAfter1 = await store.getCampaignBudgetSummary(campaign.id);
    expect(budgetAfter1.totalFundedMinor).toBe(200);
    expect(budgetAfter1.totalPaidMinor).toBe(100);
    expect(budgetAfter1.availableBudgetMinor).toBe(100);

    // Verify Worker 1 OP Balance ledger incremented by 200 OP
    workerPoints = await store.getWorkerPointsSummary("worker-1");
    expect(workerPoints.currentBalance).toBe(200);
    expect(workerPoints.totalEarned).toBe(200);

    // Verify Worker 2 has 0 OP
    const worker2Points = await store.getWorkerPointsSummary("worker-2");
    expect(worker2Points.currentBalance).toBe(0);

    // Verify append-only history entry exists
    const history = await store.listWorkerPointsHistory("worker-1");
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      deltaPoints: 200,
      reason: "TASK_REWARD",
      submissionId: sub1.id,
    });
  });

  it("prevents overspending when available budget is insufficient", async () => {
    const store = setupStore();

    const campaign = await store.createCampaign({
      ownerId: "adv-1",
      title: "Budget Cap Test",
      slug: "budget-cap-test",
      description: "Test budget limits",
      budgetMinor: 1000,
      tasks: [
        {
          platform: "X",
          title: "Share post",
          instructions: "Share post link",
          rewardPoints: 100,
          rewardAmountMinor: 150, // requires 150 cents
          slotsTotal: 5,
        },
      ],
    });

    // Fund only 100 cents (less than the 150 cents required for one payout)
    await store.fundCampaign({
      campaignId: campaign.id,
      amountMinor: 100,
    });

    await store.moderateCampaign({
      campaignId: campaign.id,
      moderatorId: "admin-1",
      action: "approve",
    });

    const sub = await store.createSubmission(
      { taskId: campaign.tasks[0].id, userId: "worker-1", proofUrl: "https://x.com/bob_x/status/100" },
      "soc-1",
    );

    // Attempting to approve must fail with InsufficientBudgetError
    await expect(
      store.reviewSubmission({
        submissionId: sub.id,
        reviewerId: "adv-1",
        decision: "approve",
      }),
    ).rejects.toThrow(InsufficientBudgetError);

    // Ensure budget was not deducted and worker received no points
    const budget = await store.getCampaignBudgetSummary(campaign.id);
    expect(budget.availableBudgetMinor).toBe(100);
    expect(budget.totalPaidMinor).toBe(0);

    const points = await store.getWorkerPointsSummary("worker-1");
    expect(points.currentBalance).toBe(0);

    // Submission remains PENDING
    const storedSub = await store.findSubmissionById(sub.id);
    expect(storedSub?.status).toBe("PENDING");
  });
});
