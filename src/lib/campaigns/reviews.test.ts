import { describe, expect, it } from "vitest";
import { MemoryCampaignStore } from "@/lib/campaigns/memory-store";
import {
  appealSubmissionService,
  decideAppealService,
  reviewSubmissionService,
} from "@/lib/campaigns/service";

describe("Submission Review Queues, Rejection Reasons & Appeals", () => {
  async function setupStoreWithSubmission() {
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

    const campaign = await store.createCampaign({
      ownerId: "adv-1",
      title: "Engagement Drive",
      slug: "engagement-drive",
      description: "Drive traffic to our announcement",
      budgetMinor: 10000,
      tasks: [
        {
          title: "Retweet our launch post",
          instructions: "Retweet our launch post on X with your handle",
          platform: "X",
          rewardPoints: 150,
          rewardAmountMinor: 150,
          slotsTotal: 5,
        },
      ],
    });

    await store.fundCampaign({ campaignId: campaign.id, amountMinor: 5000 });

    await store.moderateCampaign({
      campaignId: campaign.id,
      moderatorId: "admin-1",
      action: "approve",
    });

    const task = campaign.tasks[0];
    const submission = await store.createSubmission(
      {
        taskId: task.id,
        userId: "worker-1",
        proofUrl: "https://x.com/bob_x/status/123456789",
      },
      "soc-1",
    );

    return { store, campaign, task, submission };
  }

  it("requires rejectionReason when rejecting a submission", async () => {
    const { store, submission } = await setupStoreWithSubmission();

    // Rejection without reason fails validation
    const failRes = await reviewSubmissionService(
      { id: "adv-1", role: "ADVERTISER" },
      {
        submissionId: submission.id,
        decision: "reject",
        rejectionReason: "no", // Less than 5 chars
      },
      store,
    );

    expect(failRes.ok).toBe(false);
    if (!failRes.ok) {
      expect(failRes.status).toBe(400);
      expect(failRes.fieldErrors?.rejectionReason).toBeDefined();
    }

    // Rejection with valid reason succeeds
    const okRes = await reviewSubmissionService(
      { id: "adv-1", role: "ADVERTISER" },
      {
        submissionId: submission.id,
        decision: "reject",
        rejectionReason: "Screenshot does not show the retweet timestamp.",
      },
      store,
    );

    expect(okRes.ok).toBe(true);
    if (okRes.ok) {
      expect(okRes.data.status).toBe("REJECTED");
      expect(okRes.data.rejectionReason).toBe("Screenshot does not show the retweet timestamp.");
    }

    // Worker OP balance remains 0
    const points = await store.getWorkerPointsSummary("worker-1");
    expect(points.currentBalance).toBe(0);
  });

  it("awards OP points and records points ledger entry when approved", async () => {
    const { store, submission, task } = await setupStoreWithSubmission();

    const result = await reviewSubmissionService(
      { id: "adv-1", role: "ADVERTISER" },
      {
        submissionId: submission.id,
        decision: "approve",
      },
      store,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("APPROVED");
      expect(result.data.rewardPoints).toBe(task.rewardPoints);
    }

    // Check worker points summary & history
    const summary = await store.getWorkerPointsSummary("worker-1");
    expect(summary.currentBalance).toBe(150);
    expect(summary.totalEarned).toBe(150);

    const history = await store.listWorkerPointsHistory("worker-1");
    expect(history.length).toBe(1);
    expect(history[0].deltaPoints).toBe(150);
    expect(history[0].submissionId).toBe(submission.id);
  });

  it("allows workers to appeal rejected submissions with valid justification", async () => {
    const { store, submission } = await setupStoreWithSubmission();

    // 1. Reject first
    await reviewSubmissionService(
      { id: "adv-1", role: "ADVERTISER" },
      {
        submissionId: submission.id,
        decision: "reject",
        rejectionReason: "Handle does not match proof link.",
      },
      store,
    );

    // 2. Appeal with too short reason fails
    const failAppeal = await appealSubmissionService(
      { id: "worker-1", role: "WORKER" },
      {
        submissionId: submission.id,
        appealReason: "it does!", // Less than 10 chars
      },
      store,
    );
    expect(failAppeal.ok).toBe(false);

    // 3. Different worker cannot appeal
    const wrongWorkerAppeal = await appealSubmissionService(
      { id: "worker-2", role: "WORKER" },
      {
        submissionId: submission.id,
        appealReason: "I am appealing on their behalf because they were right.",
      },
      store,
    );
    expect(wrongWorkerAppeal.ok).toBe(false);
    if (!wrongWorkerAppeal.ok) {
      expect(wrongWorkerAppeal.status).toBe(403);
    }

    // 4. Submission author appeals with valid justification
    const okAppeal = await appealSubmissionService(
      { id: "worker-1", role: "WORKER" },
      {
        submissionId: submission.id,
        appealReason: "The handle in the screenshot is @bob_x which matches my verified profile.",
      },
      store,
    );

    expect(okAppeal.ok).toBe(true);
    if (okAppeal.ok) {
      expect(okAppeal.data.status).toBe("APPEALED");
      expect(okAppeal.data.appealReason).toContain("@bob_x");
      expect(okAppeal.data.appealedAt).toBeDefined();
    }
  });

  it("handles appeal overturn by crediting points and updating status to APPROVED", async () => {
    const { store, submission } = await setupStoreWithSubmission();

    // Reject then appeal
    await store.reviewSubmission({
      submissionId: submission.id,
      reviewerId: "adv-1",
      decision: "reject",
      rejectionReason: "Proof URL gave 404 error at check time.",
    });

    await store.appealSubmission({
      submissionId: submission.id,
      userId: "worker-1",
      appealReason: "X was briefly down; the tweet is live and publicly accessible now.",
    });

    // Admin / Moderator overturns the rejection
    const overturnRes = await decideAppealService(
      { id: "admin-1", role: "ADMIN" },
      {
        submissionId: submission.id,
        decision: "overturn",
        note: "Verified tweet is live and matches requirements.",
      },
      store,
    );

    expect(overturnRes.ok).toBe(true);
    if (overturnRes.ok) {
      expect(overturnRes.data.status).toBe("APPROVED");
      expect(overturnRes.data.appealReviewNote).toBe("Verified tweet is live and matches requirements.");
    }

    // Worker received their reward points
    const points = await store.getWorkerPointsSummary("worker-1");
    expect(points.currentBalance).toBe(150);

    const history = await store.listWorkerPointsHistory("worker-1");
    expect(history.length).toBe(1);
    expect(history[0].deltaPoints).toBe(150);
  });

  it("handles appeal uphold by keeping status REJECTED without points credit", async () => {
    const { store, submission } = await setupStoreWithSubmission();

    await store.reviewSubmission({
      submissionId: submission.id,
      reviewerId: "adv-1",
      decision: "reject",
      rejectionReason: "Not the requested tweet.",
    });

    await store.appealSubmission({
      submissionId: submission.id,
      userId: "worker-1",
      appealReason: "I retweeted a quote tweet of the post instead.",
    });

    // Moderator upholds rejection
    const upholdRes = await decideAppealService(
      { id: "admin-1", role: "ADMIN" },
      {
        submissionId: submission.id,
        decision: "uphold",
        note: "Task specifically required retweeting the original post.",
      },
      store,
    );

    expect(upholdRes.ok).toBe(true);
    if (upholdRes.ok) {
      expect(upholdRes.data.status).toBe("REJECTED");
      expect(upholdRes.data.appealReviewNote).toBe("Task specifically required retweeting the original post.");
    }

    // No points awarded
    const points = await store.getWorkerPointsSummary("worker-1");
    expect(points.currentBalance).toBe(0);
  });
});
