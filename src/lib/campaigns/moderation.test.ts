import { describe, expect, it } from "vitest";
import { MemoryCampaignStore } from "@/lib/campaigns/memory-store";
import {
  createCampaignService,
  fundCampaignService,
  moderateCampaignService,
  reviewSubmissionService,
} from "@/lib/campaigns/service";

describe("Campaign Moderation & Role Authorization", () => {
  function setupStore() {
    const store = new MemoryCampaignStore();
    store.registerUser({ id: "adv-1", displayName: "Alice Advertiser", email: "alice@example.com" });
    store.registerUser({ id: "adv-2", displayName: "Eve Competitor", email: "eve@example.com" });
    store.registerUser({ id: "worker-1", displayName: "Bob Worker", email: "bob@example.com" });
    store.registerUser({ id: "admin-1", displayName: "Super Admin", email: "admin@example.com" });

    store.registerSocialAccount({
      id: "soc-1",
      userId: "worker-1",
      platform: "X",
      handle: "bob_x",
      status: "ACTIVE",
    });

    return store;
  }

  it("restricts campaign creation to ADVERTISER and ADMIN roles", async () => {
    const store = setupStore();

    const campaignPayload = {
      title: "New Product Promo",
      slug: "new-product-promo",
      description: "Help spread the word about our new product.",
      budgetMinor: 5000,
      tasks: [
        {
          title: "Follow @osiria on X",
          instructions: "Follow our official account on X",
          platform: "X",
          rewardPoints: 50,
          rewardAmountMinor: 50,
          slotsTotal: 10,
        },
      ],
    };

    // Worker role is forbidden
    const workerRes = await createCampaignService(
      { id: "worker-1", role: "WORKER" },
      campaignPayload,
      store,
    );
    expect(workerRes.ok).toBe(false);
    if (!workerRes.ok) {
      expect(workerRes.status).toBe(403);
    }

    // Unauthenticated is unauthorized
    const anonRes = await createCampaignService(null, campaignPayload, store);
    expect(anonRes.ok).toBe(false);
    if (!anonRes.ok) {
      expect(anonRes.status).toBe(401);
    }

    // Advertiser can create campaign
    const advRes = await createCampaignService(
      { id: "adv-1", role: "ADVERTISER" },
      campaignPayload,
      store,
    );
    expect(advRes.ok).toBe(true);
    if (advRes.ok) {
      expect(advRes.data.status).toBe("DRAFT");
      expect(advRes.data.ownerId).toBe("adv-1");
    }
  });

  it("restricts campaign moderation actions to ADMIN role", async () => {
    const store = setupStore();

    const campaign = await store.createCampaign({
      ownerId: "adv-1",
      title: "Pending Campaign",
      slug: "pending-campaign",
      description: "Waiting for moderation review",
      budgetMinor: 5000,
      tasks: [
        {
          title: "Like our post",
          instructions: "Like our pinned announcement post",
          platform: "X",
          rewardPoints: 20,
          rewardAmountMinor: 20,
          slotsTotal: 10,
        },
      ],
    });

    // Advertiser cannot moderate their own or others' campaign
    const advModRes = await moderateCampaignService(
      { id: "adv-1", role: "ADVERTISER" },
      {
        campaignId: campaign.id,
        action: "approve",
      },
      store,
    );
    expect(advModRes.ok).toBe(false);
    if (!advModRes.ok) {
      expect(advModRes.status).toBe(403);
    }

    // Worker cannot moderate
    const workerModRes = await moderateCampaignService(
      { id: "worker-1", role: "WORKER" },
      {
        campaignId: campaign.id,
        action: "approve",
      },
      store,
    );
    expect(workerModRes.ok).toBe(false);
    if (!workerModRes.ok) {
      expect(workerModRes.status).toBe(403);
    }

    // Admin can approve
    const adminApproveRes = await moderateCampaignService(
      { id: "admin-1", role: "ADMIN" },
      {
        campaignId: campaign.id,
        action: "approve",
        reviewNotes: "Meets platform safety and quality guidelines.",
      },
      store,
    );
    expect(adminApproveRes.ok).toBe(true);
    if (adminApproveRes.ok) {
      expect(adminApproveRes.data.status).toBe("OPEN");
    }

    // Admin can pause
    const adminPauseRes = await moderateCampaignService(
      { id: "admin-1", role: "ADMIN" },
      {
        campaignId: campaign.id,
        action: "pause",
        reviewNotes: "Investigating spam reports.",
      },
      store,
    );
    expect(adminPauseRes.ok).toBe(true);
    if (adminPauseRes.ok) {
      expect(adminPauseRes.data.status).toBe("PAUSED");
    }

    // Admin can resume
    const adminResumeRes = await moderateCampaignService(
      { id: "admin-1", role: "ADMIN" },
      {
        campaignId: campaign.id,
        action: "resume",
      },
      store,
    );
    expect(adminResumeRes.ok).toBe(true);
    if (adminResumeRes.ok) {
      expect(adminResumeRes.data.status).toBe("OPEN");
    }

    // Admin can close
    const adminCloseRes = await moderateCampaignService(
      { id: "admin-1", role: "ADMIN" },
      {
        campaignId: campaign.id,
        action: "close",
      },
      store,
    );
    expect(adminCloseRes.ok).toBe(true);
    if (adminCloseRes.ok) {
      expect(adminCloseRes.data.status).toBe("CLOSED");
    }
  });

  it("prevents advertisers from funding or reviewing campaigns owned by someone else", async () => {
    const store = setupStore();

    // Alice creates campaign
    const campaign = await store.createCampaign({
      ownerId: "adv-1",
      title: "Alice's Campaign",
      slug: "alices-campaign",
      description: "Alice's marketing budget",
      budgetMinor: 1000,
      tasks: [
        {
          title: "Follow Alice",
          instructions: "Follow Alice's handle on X",
          platform: "X",
          rewardPoints: 50,
          rewardAmountMinor: 50,
          slotsTotal: 2,
        },
      ],
    });

    await store.moderateCampaign({
      campaignId: campaign.id,
      moderatorId: "admin-1",
      action: "approve",
    });

    // Eve (competitor) attempts to fund Alice's campaign -> Forbidden
    const fundRes = await fundCampaignService(
      { id: "adv-2", role: "ADVERTISER" },
      {
        campaignId: campaign.id,
        amountMinor: 500,
      },
      store,
    );
    expect(fundRes.ok).toBe(false);
    if (!fundRes.ok) {
      expect(fundRes.status).toBe(403);
      expect(fundRes.message).toContain("only fund your own");
    }

    // Alice funds her campaign
    await store.fundCampaign({ campaignId: campaign.id, amountMinor: 100 });

    // Worker submits proof
    const sub = await store.createSubmission(
      {
        taskId: campaign.tasks[0].id,
        userId: "worker-1",
        proofUrl: "https://x.com/bob_x/status/123",
      },
      "soc-1",
    );

    // Eve attempts to review Alice's submission -> Forbidden
    const reviewRes = await reviewSubmissionService(
      { id: "adv-2", role: "ADVERTISER" },
      {
        submissionId: sub.id,
        decision: "approve",
      },
      store,
    );
    expect(reviewRes.ok).toBe(false);
    if (!reviewRes.ok) {
      expect(reviewRes.status).toBe(403);
      expect(reviewRes.message).toContain("only review submissions for your own");
    }

    // Alice can review her own campaign's submission
    const aliceReviewRes = await reviewSubmissionService(
      { id: "adv-1", role: "ADVERTISER" },
      {
        submissionId: sub.id,
        decision: "approve",
      },
      store,
    );
    expect(aliceReviewRes.ok).toBe(true);
  });
});
