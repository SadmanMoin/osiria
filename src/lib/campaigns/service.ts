import { AUTH_REQUIRED_MESSAGE, FORBIDDEN_MESSAGE, type UserRole } from "@/lib/auth/constants";
import {
  CampaignError,
  type CampaignStore,
} from "@/lib/campaigns/store";
import type {
  AdvertiserFundsSummary,
  CampaignBudgetSummary,
  PointsHistoryEntry,
  StoredCampaign,
  StoredSubmission,
  WorkerPointsSummary,
} from "@/lib/campaigns/types";
import {
  parseAppealSubmission,
  parseCreateCampaign,
  parseCreateSubmission,
  parseDecideAppeal,
  parseFundCampaign,
  parseModerateCampaign,
  parseReviewSubmission,
} from "@/lib/campaigns/validation";
import { getPrisma } from "@/lib/db/prisma";
import type { StoredFraudEvent } from "@/lib/security/types";
import { generalApiLimiter, submissionRateLimiter, fundingRateLimiter } from "@/lib/security/rate-limit";

export type CampaignActor = {
  id: string;
  role: UserRole;
};

export type ServiceResult<T> =
  | { ok: true; data: T; message?: string }
  | { ok: false; status: number; message: string; fieldErrors?: Record<string, string> };

function failure(
  status: number,
  message: string,
  fieldErrors?: Record<string, string>,
): ServiceResult<never> {
  return { ok: false, status, message, fieldErrors };
}

export type SocialAccountFinder = (
  userId: string,
  platform: string,
) => Promise<{ id: string; status: string } | null>;

export const defaultSocialAccountFinder: SocialAccountFinder = async (userId, platform) => {
  try {
    const prisma = getPrisma();
    const account = await prisma.socialAccount.findFirst({
      where: {
        userId,
        platform: platform as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        status: "ACTIVE",
      },
      select: { id: true, status: true },
    });
    return account;
  } catch {
    return null;
  }
};

export async function createCampaignService(
  actor: CampaignActor | null,
  input: unknown,
  store: CampaignStore,
): Promise<ServiceResult<StoredCampaign>> {
  if (!actor || !actor.id) {
    return failure(401, AUTH_REQUIRED_MESSAGE);
  }
  if (actor.role !== "ADVERTISER" && actor.role !== "ADMIN") {
    return failure(403, FORBIDDEN_MESSAGE);
  }

  const limit = generalApiLimiter.check(`createCampaignService:${actor.id}`);
  if (!limit.ok) return failure(429, `Too many requests. Retry in ${limit.retryAfterSeconds} seconds.`);

  const parsed = parseCreateCampaign(input, actor.id);
  if (!parsed.ok) {
    return failure(400, parsed.message, parsed.fieldErrors);
  }

  try {
    const campaign = await store.createCampaign(parsed.data);
    return { ok: true, data: campaign, message: "Campaign created successfully as draft." };
  } catch (error) {
    if (error instanceof CampaignError) {
      return failure(error.status, error.message);
    }
    throw error;
  }
}

export async function fundCampaignService(
  actor: CampaignActor | null,
  input: unknown,
  store: CampaignStore,
): Promise<ServiceResult<CampaignBudgetSummary>> {
  if (!actor || !actor.id) {
    return failure(401, AUTH_REQUIRED_MESSAGE);
  }
  if (actor.role !== "ADVERTISER" && actor.role !== "ADMIN") {
    return failure(403, FORBIDDEN_MESSAGE);
  }

  const limit = fundingRateLimiter.check(`fundCampaignService:${actor.id}`);
  if (!limit.ok) return failure(429, `Too many requests. Retry in ${limit.retryAfterSeconds} seconds.`);

  const parsed = parseFundCampaign(input);
  if (!parsed.ok) {
    return failure(400, parsed.message, parsed.fieldErrors);
  }

  const campaign = await store.findCampaignById(parsed.data.campaignId);
  if (!campaign) {
    return failure(404, "Campaign not found.");
  }
  if (actor.role !== "ADMIN" && campaign.ownerId !== actor.id) {
    return failure(403, "You can only fund your own campaigns.");
  }

  // No trusted payment settlement integration exists yet. Never manufacture funds.
  return failure(409, "Funding is unavailable until verified payment settlement is configured.");

}

export async function moderateCampaignService(
  actor: CampaignActor | null,
  input: unknown,
  store: CampaignStore,
): Promise<ServiceResult<StoredCampaign>> {
  if (!actor || !actor.id) {
    return failure(401, AUTH_REQUIRED_MESSAGE);
  }
  if (actor.role !== "ADMIN") {
    return failure(403, FORBIDDEN_MESSAGE);
  }

  const limit = generalApiLimiter.check(`moderateCampaignService:${actor.id}`);
  if (!limit.ok) return failure(429, `Too many requests. Retry in ${limit.retryAfterSeconds} seconds.`);

  const parsed = parseModerateCampaign(input, actor.id);
  if (!parsed.ok) {
    return failure(400, parsed.message, parsed.fieldErrors);
  }

  const updated = await store.moderateCampaign(parsed.data);
  if (!updated) {
    return failure(404, "Campaign not found.");
  }

  return { ok: true, data: updated, message: `Campaign moderated: ${parsed.data.action}.` };
}

export async function submitTaskProofService(
  actor: CampaignActor | null,
  input: unknown,
  store: CampaignStore,
  socialFinder: SocialAccountFinder = defaultSocialAccountFinder,
): Promise<ServiceResult<StoredSubmission>> {
  if (!actor || !actor.id) {
    return failure(401, AUTH_REQUIRED_MESSAGE);
  }
  if (actor.role !== "WORKER") {
    return failure(403, "Only worker accounts can submit task proofs.");
  }

  const limit = submissionRateLimiter.check(`submitTaskProofService:${actor.id}`);
  if (!limit.ok) return failure(429, `Too many requests. Retry in ${limit.retryAfterSeconds} seconds.`);

  const parsed = parseCreateSubmission(input, actor.id);
  if (!parsed.ok) {
    return failure(400, parsed.message, parsed.fieldErrors);
  }

  const task = await store.findTaskById(parsed.data.taskId);
  if (!task) {
    return failure(404, "Task not found.");
  }

  // Verify social account requirement
  const social = await socialFinder(actor.id, task.platform);
  if (!social || social.status !== "ACTIVE") {
    return failure(
      400,
      `You need an active, verified ${task.platform} account linked to submit proof for this task.`,
      { platform: `Connect your ${task.platform} handle in Social Eligibility first.` },
    );
  }

  try {
    const submission = await store.createSubmission(parsed.data, social.id);
    const msg =
      submission.status === "FLAGGED"
        ? "Proof submitted, but flagged for security review. An administrator will inspect your submission before rewards can be issued."
        : "Proof submitted. It is now pending review in the queue.";
    return {
      ok: true,
      data: submission,
      message: msg,
    };
  } catch (error) {
    if (error instanceof CampaignError) {
      return failure(error.status, error.message);
    }
    throw error;
  }
}

export async function reviewSubmissionService(
  actor: CampaignActor | null,
  input: unknown,
  store: CampaignStore,
): Promise<ServiceResult<StoredSubmission>> {
  if (!actor || !actor.id) {
    return failure(401, AUTH_REQUIRED_MESSAGE);
  }
  if (actor.role !== "ADVERTISER" && actor.role !== "ADMIN") {
    return failure(403, FORBIDDEN_MESSAGE);
  }

  const limit = generalApiLimiter.check(`reviewSubmissionService:${actor.id}`);
  if (!limit.ok) return failure(429, `Too many requests. Retry in ${limit.retryAfterSeconds} seconds.`);

  const parsed = parseReviewSubmission(input, actor.id);
  if (!parsed.ok) {
    return failure(400, parsed.message, parsed.fieldErrors);
  }

  const existing = await store.findSubmissionById(parsed.data.submissionId);
  if (!existing) {
    return failure(404, "Submission not found.");
  }

  // Advertiser can only review their own campaigns
  if (actor.role !== "ADMIN" && existing.campaignOwnerId !== actor.id) {
    return failure(403, "You can only review submissions for your own campaigns.");
  }
  if (existing.status === "FLAGGED" || existing.status === "APPEALED") {
    return failure(409, "Flagged submissions require fraud resolution; appeals require the admin appeal decision workflow.");
  }
  if (existing.userId === actor.id) {
    return failure(403, "You cannot review your own submission.");
  }

  try {
    const reviewed = await store.reviewSubmission(parsed.data);
    const msg =
      parsed.data.decision === "approve"
        ? `Submission approved! Reward of ${reviewed.rewardPoints} OP credited.`
        : "Submission rejected.";
    return { ok: true, data: reviewed, message: msg };
  } catch (error) {
    if (error instanceof CampaignError) {
      return failure(error.status, error.message);
    }
    throw error;
  }
}

export async function appealSubmissionService(
  actor: CampaignActor | null,
  input: unknown,
  store: CampaignStore,
): Promise<ServiceResult<StoredSubmission>> {
  if (!actor || !actor.id) {
    return failure(401, AUTH_REQUIRED_MESSAGE);
  }
  if (actor.role !== "WORKER") {
    return failure(403, "Only workers can appeal rejected submissions.");
  }

  const limit = generalApiLimiter.check(`appealSubmissionService:${actor.id}`);
  if (!limit.ok) return failure(429, `Too many requests. Retry in ${limit.retryAfterSeconds} seconds.`);

  const parsed = parseAppealSubmission(input, actor.id);
  if (!parsed.ok) {
    return failure(400, parsed.message, parsed.fieldErrors);
  }

  const existing = await store.findSubmissionById(parsed.data.submissionId);
  if (!existing) {
    return failure(404, "Submission not found.");
  }
  if (existing.userId !== actor.id) {
    return failure(403, "You can only appeal your own submissions.");
  }

  try {
    const appealed = await store.appealSubmission(parsed.data);
    return {
      ok: true,
      data: appealed,
      message: "Appeal submitted. A moderator will re-evaluate your submission.",
    };
  } catch (error) {
    if (error instanceof CampaignError) {
      return failure(error.status, error.message);
    }
    throw error;
  }
}

export async function decideAppealService(
  actor: CampaignActor | null,
  input: unknown,
  store: CampaignStore,
): Promise<ServiceResult<StoredSubmission>> {
  if (!actor || !actor.id) {
    return failure(401, AUTH_REQUIRED_MESSAGE);
  }
  if (actor.role !== "ADMIN") {
    return failure(403, FORBIDDEN_MESSAGE);
  }

  const limit = generalApiLimiter.check(`decideAppealService:${actor.id}`);
  if (!limit.ok) return failure(429, `Too many requests. Retry in ${limit.retryAfterSeconds} seconds.`);

  const parsed = parseDecideAppeal(input, actor.id);
  if (!parsed.ok) {
    return failure(400, parsed.message, parsed.fieldErrors);
  }

  const existing = await store.findSubmissionById(parsed.data.submissionId);
  if (!existing) {
    return failure(404, "Submission not found.");
  }

  if (actor.role !== "ADMIN" && existing.campaignOwnerId !== actor.id) {
    return failure(403, "You can only review appeals for your own campaigns.");
  }

  try {
    const decided = await store.decideAppeal(parsed.data);
    const msg =
      parsed.data.decision === "overturn"
        ? `Appeal approved and overturned. ${decided.rewardPoints} OP awarded.`
        : "Appeal rejected and original decision upheld.";
    return { ok: true, data: decided, message: msg };
  } catch (error) {
    if (error instanceof CampaignError) {
      return failure(error.status, error.message);
    }
    throw error;
  }
}

export async function getWorkerPointsService(
  actor: CampaignActor | null,
  store: CampaignStore,
): Promise<ServiceResult<{ summary: WorkerPointsSummary; history: PointsHistoryEntry[] }>> {
  if (!actor || !actor.id) {
    return failure(401, AUTH_REQUIRED_MESSAGE);
  }
  if (actor.role !== "WORKER") return failure(403, FORBIDDEN_MESSAGE);
  const summary = await store.getWorkerPointsSummary(actor.id);
  const history = await store.listWorkerPointsHistory(actor.id);
  return { ok: true, data: { summary, history } };
}

export async function getAdvertiserFundsService(
  actor: CampaignActor | null,
  store: CampaignStore,
): Promise<ServiceResult<AdvertiserFundsSummary>> {
  if (!actor || !actor.id) {
    return failure(401, AUTH_REQUIRED_MESSAGE);
  }
  if (actor.role !== "ADVERTISER" && actor.role !== "ADMIN") {
    return failure(403, FORBIDDEN_MESSAGE);
  }
  const summary = await store.getAdvertiserFundsSummary(actor.id);
  return { ok: true, data: summary };
}

export async function listFraudEventsService(
  actor: CampaignActor | null,
  store: CampaignStore,
  filters?: { userId?: string; severity?: string },
): Promise<ServiceResult<StoredFraudEvent[]>> {
  if (!actor || !actor.id) {
    return failure(401, AUTH_REQUIRED_MESSAGE);
  }
  if (actor.role !== "ADMIN") {
    return failure(403, FORBIDDEN_MESSAGE);
  }
  const events = await store.listFraudEvents(filters);
  return { ok: true, data: events };
}

export async function resolveFraudEventService(
  actor: CampaignActor | null,
  eventId: string,
  action: "DISMISS" | "CONFIRM",
  note: string | undefined,
  store: CampaignStore,
): Promise<ServiceResult<{ message: string }>> {
  if (!actor || !actor.id) {
    return failure(401, AUTH_REQUIRED_MESSAGE);
  }
  if (actor.role !== "ADMIN") {
    return failure(403, FORBIDDEN_MESSAGE);
  }
  if (!eventId || eventId.length > 200 || !["DISMISS", "CONFIRM"].includes(action) ||
      typeof note !== "string" || note.trim().length < 10 || note.length > 1000) {
    return failure(400, "Choose DISMISS or CONFIRM and provide a review note of 10–1000 characters.");
  }
  const limit = generalApiLimiter.check(`fraud.resolve:${actor.id}`);
  if (!limit.ok) return failure(429, "Too many fraud decisions. Try again shortly.");
  try {
    const result = await store.resolveFraudEvent(eventId, action, actor.id, note);
    return { ok: true, data: result, message: result.message };
  } catch (error) {
    if (error instanceof CampaignError) {
      return failure(error.status, error.message);
    }
    throw error;
  }
}
