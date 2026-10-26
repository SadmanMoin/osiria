import { beforeEach, describe, expect, it, vi } from "vitest";
import { readJsonObject, rejectCrossOrigin } from "@/lib/auth/http";
import type { StoredUser } from "@/lib/auth/repository";
import { MemoryCampaignStore } from "@/lib/campaigns/memory-store";
import { postResolveFraudEvent, postWorkerSubmission, getAdminFraudEvents } from "@/lib/campaigns/http";
import { decideAppealService, fundCampaignService, resolveFraudEventService, reviewSubmissionService, submitTaskProofService } from "@/lib/campaigns/service";
import { parseCreateCampaign, parseCreateSubmission } from "@/lib/campaigns/validation";
import { normalizeProofUrl, validatePlatformDomain } from "@/lib/security/fraud";
import { fundingRateLimiter, generalApiLimiter, submissionRateLimiter } from "@/lib/security/rate-limit";

const admin: StoredUser = { id: "admin-security", role: "ADMIN", status: "ACTIVE", email: "admin@example.test", displayName: "Admin", passwordHash: "private" };
const owner = { id: "owner-security", role: "ADVERTISER" as const };

async function fixture() {
  const store = new MemoryCampaignStore();
  store.registerUser({ id: "worker-security", displayName: "Worker", email: "worker@example.test" });
  store.registerSocialAccount({ id: "social-security", userId: "worker-security", platform: "X", handle: "alice", status: "ACTIVE" });
  const campaign = await store.createCampaign({ ownerId: owner.id, title: "Security campaign", slug: "security-campaign", description: "Campaign security regression", budgetMinor: 1000, tasks: [{ platform: "X", title: "Share post", instructions: "Share the campaign post", rewardPoints: 1, rewardAmountMinor: 100, slotsTotal: 10 }] });
  await store.moderateCampaign({ campaignId: campaign.id, moderatorId: admin.id, action: "approve" });
  const submission = await store.createSubmission({ taskId: campaign.tasks[0].id, userId: "worker-security", proofUrl: "https://x.com/other/status/987" }, "social-security");
  return { store, campaign, submission };
}

beforeEach(() => { generalApiLimiter.reset(); submissionRateLimiter.reset(); fundingRateLimiter.reset(); });

describe("Phase 6 regression coverage", () => {
  it("rejects forged forwarded hosts and scheme downgrades", () => {
    for (const origin of ["https://attacker.test", "http://osiria.test"]) {
      expect(rejectCrossOrigin(new Request("https://osiria.test/api", { method: "POST", headers: { origin, "x-forwarded-host": "attacker.test" } }))?.status).toBe(403);
    }
  });

  it("rejects cross-site requests even without Origin", () => {
    expect(rejectCrossOrigin(new Request("https://osiria.test/api", { headers: { "sec-fetch-site": "cross-site" } }))?.status).toBe(403);
  });

  it.each(["[]", "null", "bad json", "true"])("rejects invalid JSON objects: %s", async (body) => {
    const response = await readJsonObject(new Request("https://osiria.test/api", { method: "POST", body }));
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(400);
  });

  it("limits streamed bodies without trusting Content-Length", async () => {
    const response = await readJsonObject(new Request("https://osiria.test/api", { method: "POST", body: JSON.stringify({ note: "x".repeat(20_001) }) }));
    expect((response as Response).status).toBe(413);
  });

  it("canonicalizes X aliases, protocol, handles, and tracking to the post ID", () => {
    expect(normalizeProofUrl("http://twitter.com/old/status/987?s=1")).toBe(normalizeProofUrl("https://x.com/new/status/987?foo=2"));
  });

  it.each(["javascript://x.com/alice", "https://user:password@x.com/alice", "https://x.com:444/alice", "https://x.com.evil.test/alice"])("rejects unsafe platform links: %s", (url) => {
    expect(validatePlatformDomain("X", url).valid).toBe(false);
  });

  it("rejects credential URLs and excessive URL lengths before storage", () => {
    for (const proofUrl of ["https://secret@x.com/alice", `https://x.com/${"a".repeat(2048)}`]) {
      expect(parseCreateSubmission({ taskId: "task", proofUrl }, "worker").ok).toBe(false);
    }
  });

  it("rejects database integer overflow and boolean financial inputs", () => {
    const input = { title: "Campaign", slug: "campaign", description: "Campaign description", budgetMinor: 2_147_483_648, tasks: [{ platform: "X", title: "Share post", instructions: "Share our post please", rewardPoints: true, rewardAmountMinor: 10, slotsTotal: 1 }] };
    const result = parseCreateCampaign(input, owner.id);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.fieldErrors.budgetMinor).toBeDefined();
      expect(result.fieldErrors["tasks[0].rewardPoints"]).toBeDefined();
    }
  });

  it("cannot mint funds through the public service, even as admin", async () => {
    const { store, campaign } = await fixture();
    const fund = vi.spyOn(store, "fundCampaign");
    for (const actor of [owner, admin]) expect(await fundCampaignService(actor, { campaignId: campaign.id, amountMinor: 100 }, store)).toMatchObject({ ok: false, status: 409 });
    expect(fund).not.toHaveBeenCalled();
  });

  it("quarantines suspicious proofs and prevents owner and admin ordinary approval", async () => {
    const { store, submission } = await fixture();
    expect(submission.status).toBe("FLAGGED");
    for (const actor of [owner, admin]) expect(await reviewSubmissionService(actor, { submissionId: submission.id, decision: "approve" }, store)).toMatchObject({ ok: false, status: 409 });
    expect((await store.getWorkerPointsSummary(submission.userId)).currentBalance).toBe(0);
  });

  it("requires admin, explicit action, a reason, and a single resolution", async () => {
    const { store } = await fixture();
    const [event] = await store.listFraudEvents();
    expect(await resolveFraudEventService(owner, event.id, "DISMISS", "Manual evidence checked", store)).toMatchObject({ status: 403 });
    expect(await resolveFraudEventService(admin, event.id, "DISMISS", "", store)).toMatchObject({ status: 400 });
    expect(await resolveFraudEventService(admin, event.id, "DISMISS", "Manual evidence checked", store)).toMatchObject({ ok: true });
    expect(await resolveFraudEventService(admin, event.id, "CONFIRM", "Repeated decision attempt", store)).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects advertiser appeal decisions", async () => {
    const { store, submission } = await fixture();
    expect(await decideAppealService(owner, { submissionId: submission.id, decision: "overturn", note: "Approve this appeal" }, store)).toMatchObject({ ok: false, status: 403 });
  });

  it("enforces a submission limit at the service layer used by form actions", async () => {
    const { store, campaign } = await fixture();
    const finder = vi.fn(async () => null);
    const actor = { id: "worker-security", role: "WORKER" as const };
    for (let i = 0; i < 10; i++) await submitTaskProofService(actor, { taskId: campaign.tasks[0].id, proofUrl: "https://x.com/alice/status/123" }, store, finder);
    expect(await submitTaskProofService(actor, { taskId: campaign.tasks[0].id, proofUrl: "https://x.com/alice/status/123" }, store, finder)).toMatchObject({ ok: false, status: 429 });
    expect(finder).toHaveBeenCalledTimes(10);
  });

  it("guards fraud APIs against anonymous, non-admin, and malformed requests", async () => {
    const { store } = await fixture();
    const deps = { store, resolveUser: async () => admin };
    expect((await getAdminFraudEvents(new Request("https://osiria.test/api"), deps)).status).toBe(401);
    const req = (body: unknown) => new Request("https://osiria.test/api", { method: "POST", headers: { cookie: "osiria_session=token" }, body: JSON.stringify(body) });
    expect((await postResolveFraudEvent(req({ action: "invalid" }), "event", deps)).status).toBe(400);
    expect((await postResolveFraudEvent(req({ action: "DISMISS" }), "event", { ...deps, resolveUser: async () => ({ ...admin, role: "WORKER" }) })).status).toBe(403);
    expect((await postWorkerSubmission(req({}), { ...deps, resolveUser: async () => ({ ...admin, status: "SUSPENDED", role: "WORKER" }) })).status).toBe(401);
  });

  it("returns a generic API failure without database credentials", async () => {
    const { store } = await fixture();
    vi.spyOn(store, "listFraudEvents").mockRejectedValue(new Error("postgresql://secret:password@host/db"));
    const response = await getAdminFraudEvents(new Request("https://osiria.test/api", { headers: { cookie: "osiria_session=token" } }), { store, resolveUser: async () => admin });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("password");
  });
});
