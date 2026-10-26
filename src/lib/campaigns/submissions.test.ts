import { describe, expect, it } from "vitest";
import { MemoryCampaignStore } from "@/lib/campaigns/memory-store";
import { submitTaskProofService } from "@/lib/campaigns/service";
import { DuplicateSubmissionError, SlotLimitError } from "@/lib/campaigns/store";

describe("Task Submissions & Eligibility", () => {
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
      id: "soc-pending",
      userId: "worker-1",
      platform: "INSTAGRAM",
      handle: "bob_ig",
      status: "PENDING",
    });

    return store;
  }

  async function createOpenCampaignWithTask(
    store: MemoryCampaignStore,
    options?: { slotsTotal?: number; platform?: "X" | "FACEBOOK" | "INSTAGRAM" },
  ) {
    const campaign = await store.createCampaign({
      ownerId: "adv-1",
      title: "Community Boost",
      slug: `community-boost-${Math.random().toString(36).slice(2, 7)}`,
      description: "Retweet and share our post",
      budgetMinor: 10000,
      tasks: [
        {
          title: "Retweet Launch Announcement",
          instructions: "Retweet our official announcement on X",
          platform: options?.platform ?? "X",
          rewardPoints: 100,
          rewardAmountMinor: 100,
          slotsTotal: options?.slotsTotal ?? 2,
        },
      ],
    });

    await store.moderateCampaign({
      campaignId: campaign.id,
      moderatorId: "admin-1",
      action: "approve",
    });

    const task = campaign.tasks[0];
    return { campaign, task };
  }

  it("prevents duplicate submissions for the same task by the same worker", async () => {
    const store = setupStore();
    const { task } = await createOpenCampaignWithTask(store);

    // First submission succeeds
    const sub1 = await store.createSubmission(
      {
        taskId: task.id,
        userId: "worker-1",
        proofUrl: "https://x.com/bob_x/status/123456789",
      },
      "soc-1",
    );
    expect(sub1.id).toBeDefined();
    expect(sub1.status).toBe("PENDING");

    // Second submission by the same worker fails with DuplicateSubmissionError
    await expect(
      store.createSubmission(
        {
          taskId: task.id,
          userId: "worker-1",
          proofUrl: "https://x.com/bob_x/status/987654321",
        },
        "soc-1",
      ),
    ).rejects.toThrow(DuplicateSubmissionError);
  });

  it("prevents submissions when all task slots are exhausted", async () => {
    const store = setupStore();
    const { campaign, task } = await createOpenCampaignWithTask(store, { slotsTotal: 1 });

    // Fund the campaign so approval can succeed
    await store.fundCampaign({ campaignId: campaign.id, amountMinor: 100 });

    // Worker 1 submits and is approved, filling the only slot
    const sub1 = await store.createSubmission(
      {
        taskId: task.id,
        userId: "worker-1",
        proofUrl: "https://x.com/bob_x/status/123456789",
      },
      "soc-1",
    );
    await store.reviewSubmission({
      submissionId: sub1.id,
      reviewerId: "adv-1",
      decision: "approve",
    });

    // Register X account for worker 2
    store.registerSocialAccount({
      id: "soc-2",
      userId: "worker-2",
      platform: "X",
      handle: "charlie_x",
      status: "ACTIVE",
    });

    // Worker 2 attempts to submit, fails due to slot limit
    await expect(
      store.createSubmission(
        {
          taskId: task.id,
          userId: "worker-2",
          proofUrl: "https://x.com/charlie_x/status/11223344",
        },
        "soc-2",
      ),
    ).rejects.toThrow(SlotLimitError);
  });

  it("rejects submissions if campaign is not OPEN", async () => {
    const store = setupStore();
    // Create draft campaign without moderating to OPEN
    const campaign = await store.createCampaign({
      ownerId: "adv-1",
      title: "Draft Campaign",
      slug: "draft-campaign",
      description: "Not approved yet",
      budgetMinor: 5000,
      tasks: [
        {
          title: "Follow Account",
          instructions: "Follow our test account",
          platform: "X",
          rewardPoints: 50,
          rewardAmountMinor: 50,
          slotsTotal: 5,
        },
      ],
    });

    const task = campaign.tasks[0];

    await expect(
      store.createSubmission(
        {
          taskId: task.id,
          userId: "worker-1",
          proofUrl: "https://x.com/bob_x/status/123456789",
        },
        "soc-1",
      ),
    ).rejects.toThrow(/not open/i);
  });

  it("rejects submission via service when worker lacks active social account for required platform", async () => {
    const store = setupStore();
    const { task } = await createOpenCampaignWithTask(store, { platform: "FACEBOOK" });

    // Mock social finder that returns null for worker-1 on FACEBOOK
    const mockFinder = async (userId: string, platform: string) => {
      if (platform === "FACEBOOK") return null;
      return { id: "soc-1", status: "ACTIVE" };
    };

    const result = await submitTaskProofService(
      { id: "worker-1", role: "WORKER" },
      {
        taskId: task.id,
        proofUrl: "https://facebook.com/bob/posts/101010",
      },
      store,
      mockFinder,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.message).toContain("FACEBOOK");
    }
  });

  it("rejects submission via service when social account is not ACTIVE (e.g. PENDING_VERIFICATION)", async () => {
    const store = setupStore();
    const { task } = await createOpenCampaignWithTask(store, { platform: "INSTAGRAM" });

    const mockFinder = async (userId: string, platform: string) => {
      if (platform === "INSTAGRAM") {
        return { id: "soc-pending", status: "PENDING_VERIFICATION" };
      }
      return null;
    };

    const result = await submitTaskProofService(
      { id: "worker-1", role: "WORKER" },
      {
        taskId: task.id,
        proofUrl: "https://instagram.com/p/B123456/",
      },
      store,
      mockFinder,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.message).toContain("active, verified INSTAGRAM account");
    }
  });

  it("validates proofUrl format strictly and rejects invalid URLs", async () => {
    const store = setupStore();
    const { task } = await createOpenCampaignWithTask(store);

    const mockFinder = async () => ({ id: "soc-1", status: "ACTIVE" });

    // Not a valid URL
    const resultInvalid = await submitTaskProofService(
      { id: "worker-1", role: "WORKER" },
      {
        taskId: task.id,
        proofUrl: "i-did-it-trust-me",
      },
      store,
      mockFinder,
    );

    expect(resultInvalid.ok).toBe(false);
    if (!resultInvalid.ok) {
      expect(resultInvalid.status).toBe(400);
      expect(resultInvalid.fieldErrors?.proofUrl).toBeDefined();
    }

    // Valid HTTPS URL succeeds
    const resultValid = await submitTaskProofService(
      { id: "worker-1", role: "WORKER" },
      {
        taskId: task.id,
        proofUrl: "https://x.com/bob_x/status/123456789",
      },
      store,
      mockFinder,
    );

    expect(resultValid.ok).toBe(true);
    if (resultValid.ok) {
      expect(resultValid.data.proofUrl).toBe("https://x.com/bob_x/status/123456789");
      expect(resultValid.data.status).toBe("PENDING");
    }
  });
});
