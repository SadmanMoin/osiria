import { AREA_ROLES } from "@/lib/auth/authorization";
import { withRole } from "@/lib/auth/guard";
import { readJsonObject, rejectCrossOrigin } from "@/lib/auth/http";
import type { StoredUser } from "@/lib/auth/repository";
import {
  appealSubmissionService,
  createCampaignService,
  decideAppealService,
  defaultSocialAccountFinder,
  fundCampaignService,
  getAdvertiserFundsService,
  getWorkerPointsService,
  listFraudEventsService,
  moderateCampaignService,
  resolveFraudEventService,
  reviewSubmissionService,
  submitTaskProofService,
  type SocialAccountFinder,
} from "@/lib/campaigns/service";
import type { CampaignStore } from "@/lib/campaigns/store";
import {
  checkRequestRateLimit,
  fundingRateLimiter,
  submissionRateLimiter,
} from "@/lib/security/rate-limit";

export type CampaignHttpDeps = {
  resolveUser: (tokenHash: string) => Promise<StoredUser | null>;
  store: CampaignStore;
  socialFinder?: SocialAccountFinder;
};

function actorOf(user: StoredUser) {
  return { id: user.id, role: user.role };
}

async function readJson(
  request: Request,
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  const body = await readJsonObject(request);
  return body instanceof Response ? { ok: false, response: body } : { ok: true, body };
}

export async function getPublicCampaigns(
  _request: Request,
  deps: CampaignHttpDeps,
): Promise<Response> {
  try {
    const campaigns = await deps.store.listCampaigns({ status: "OPEN" });
    return Response.json({ ok: true, campaigns });
  } catch {
    return Response.json({ ok: false, message: "Campaigns are temporarily unavailable." }, { status: 503 });
  }
}

export async function postAdvertiserCampaign(
  request: Request,
  deps: CampaignHttpDeps,
): Promise<Response> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  return withRole(request, AREA_ROLES.advertiser, deps.resolveUser, async (user) => {
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const result = await createCampaignService(actorOf(user), body.body, deps.store);
    if (!result.ok) {
      return Response.json(
        { ok: false, message: result.message, fieldErrors: result.fieldErrors },
        { status: result.status },
      );
    }
    return Response.json({ ok: true, campaign: result.data, message: result.message }, { status: 201 });
  });
}

export async function postFundCampaign(
  request: Request,
  campaignId: string,
  deps: CampaignHttpDeps,
): Promise<Response> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  return withRole(request, AREA_ROLES.advertiser, deps.resolveUser, async (user) => {
    const rateLimited = checkRequestRateLimit(request, fundingRateLimiter, "fund_campaign", user.id);
    if (rateLimited) return rateLimited;

    const body = await readJson(request);
    if (!body.ok) return body.response;

    const record = typeof body.body === "object" && body.body !== null ? (body.body as Record<string, unknown>) : {};
    const result = await fundCampaignService(
      actorOf(user),
      { ...record, campaignId },
      deps.store,
    );
    if (!result.ok) {
      return Response.json(
        { ok: false, message: result.message, fieldErrors: result.fieldErrors },
        { status: result.status },
      );
    }
    return Response.json({ ok: true, summary: result.data, message: result.message });
  });
}

export async function postWorkerSubmission(
  request: Request,
  deps: CampaignHttpDeps,
): Promise<Response> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  return withRole(request, AREA_ROLES.worker, deps.resolveUser, async (user) => {
    const rateLimited = checkRequestRateLimit(request, submissionRateLimiter, "worker_submission", user.id);
    if (rateLimited) return rateLimited;

    const body = await readJson(request);
    if (!body.ok) return body.response;

    const result = await submitTaskProofService(
      actorOf(user),
      body.body,
      deps.store,
      deps.socialFinder ?? defaultSocialAccountFinder,
    );
    if (!result.ok) {
      return Response.json(
        { ok: false, message: result.message, fieldErrors: result.fieldErrors },
        { status: result.status },
      );
    }
    return Response.json({ ok: true, submission: result.data, message: result.message }, { status: 201 });
  });
}

export async function getWorkerSubmissions(
  request: Request,
  deps: CampaignHttpDeps,
): Promise<Response> {
  return withRole(request, AREA_ROLES.worker, deps.resolveUser, async (user) => {
    const submissions = await deps.store.listSubmissions({ userId: user.id });
    return Response.json({ ok: true, submissions });
  });
}

export async function postReviewSubmission(
  request: Request,
  submissionId: string,
  deps: CampaignHttpDeps,
): Promise<Response> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  return withRole(request, AREA_ROLES.advertiser, deps.resolveUser, async (user) => {
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const record = typeof body.body === "object" && body.body !== null ? (body.body as Record<string, unknown>) : {};
    const result = await reviewSubmissionService(
      actorOf(user),
      { ...record, submissionId },
      deps.store,
    );
    if (!result.ok) {
      return Response.json(
        { ok: false, message: result.message, fieldErrors: result.fieldErrors },
        { status: result.status },
      );
    }
    return Response.json({ ok: true, submission: result.data, message: result.message });
  });
}

export async function postSubmissionAppeal(
  request: Request,
  submissionId: string,
  deps: CampaignHttpDeps,
): Promise<Response> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  return withRole(request, AREA_ROLES.worker, deps.resolveUser, async (user) => {
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const record = typeof body.body === "object" && body.body !== null ? (body.body as Record<string, unknown>) : {};
    const result = await appealSubmissionService(
      actorOf(user),
      { ...record, submissionId },
      deps.store,
    );
    if (!result.ok) {
      return Response.json(
        { ok: false, message: result.message, fieldErrors: result.fieldErrors },
        { status: result.status },
      );
    }
    return Response.json({ ok: true, submission: result.data, message: result.message });
  });
}

export async function postDecideAppeal(
  request: Request,
  submissionId: string,
  deps: CampaignHttpDeps,
): Promise<Response> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  return withRole(request, AREA_ROLES.admin, deps.resolveUser, async (user) => {
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const record = typeof body.body === "object" && body.body !== null ? (body.body as Record<string, unknown>) : {};
    const result = await decideAppealService(
      actorOf(user),
      { ...record, submissionId },
      deps.store,
    );
    if (!result.ok) {
      return Response.json(
        { ok: false, message: result.message, fieldErrors: result.fieldErrors },
        { status: result.status },
      );
    }
    return Response.json({ ok: true, submission: result.data, message: result.message });
  });
}

export async function postModerateCampaign(
  request: Request,
  campaignId: string,
  deps: CampaignHttpDeps,
): Promise<Response> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  return withRole(request, AREA_ROLES.admin, deps.resolveUser, async (user) => {
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const record = typeof body.body === "object" && body.body !== null ? (body.body as Record<string, unknown>) : {};
    const result = await moderateCampaignService(
      actorOf(user),
      { ...record, campaignId },
      deps.store,
    );
    if (!result.ok) {
      return Response.json(
        { ok: false, message: result.message, fieldErrors: result.fieldErrors },
        { status: result.status },
      );
    }
    return Response.json({ ok: true, campaign: result.data, message: result.message });
  });
}

export async function getWorkerPoints(
  request: Request,
  deps: CampaignHttpDeps,
): Promise<Response> {
  return withRole(request, AREA_ROLES.worker, deps.resolveUser, async (user) => {
    const result = await getWorkerPointsService(actorOf(user), deps.store);
    if (!result.ok) {
      return Response.json({ ok: false, message: result.message }, { status: result.status });
    }
    return Response.json({ ok: true, ...result.data });
  });
}

export async function getAdvertiserFunds(
  request: Request,
  deps: CampaignHttpDeps,
): Promise<Response> {
  return withRole(request, AREA_ROLES.advertiser, deps.resolveUser, async (user) => {
    const result = await getAdvertiserFundsService(actorOf(user), deps.store);
    if (!result.ok) {
      return Response.json({ ok: false, message: result.message }, { status: result.status });
    }
    return Response.json({ ok: true, funds: result.data });
  });
}

export async function getAdminFraudEvents(
  request: Request,
  deps: CampaignHttpDeps,
): Promise<Response> {
  return withRole(request, AREA_ROLES.admin, deps.resolveUser, async (user) => {
    const result = await listFraudEventsService(actorOf(user), deps.store);
    if (!result.ok) {
      return Response.json({ ok: false, message: result.message }, { status: result.status });
    }
    return Response.json({ ok: true, fraudEvents: result.data });
  });
}

export async function postResolveFraudEvent(
  request: Request,
  eventId: string,
  deps: CampaignHttpDeps,
): Promise<Response> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  return withRole(request, AREA_ROLES.admin, deps.resolveUser, async (user) => {
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const record = typeof body.body === "object" && body.body !== null ? (body.body as Record<string, unknown>) : {};
    if (record.action !== "CONFIRM" && record.action !== "DISMISS") {
      return Response.json({ ok: false, message: "Invalid fraud action." }, { status: 400 });
    }
    const action = record.action;
    const note = typeof record.note === "string" ? record.note : undefined;

    const result = await resolveFraudEventService(
      actorOf(user),
      eventId,
      action,
      note,
      deps.store,
    );
    if (!result.ok) {
      return Response.json({ ok: false, message: result.message }, { status: result.status });
    }
    return Response.json({ ok: true, message: result.message });
  });
}
