import { AREA_ROLES } from "@/lib/auth/authorization";
import { withRole } from "@/lib/auth/guard";
import { readJsonObject, rejectCrossOrigin } from "@/lib/auth/http";
import type { StoredUser } from "@/lib/auth/repository";
import {
  decideReview,
  listEligibilityAuditLogs,
  listManualReviews,
  listPlatformRules,
  savePlatformRules,
  submitEligibilityCheck,
  type ProfileSource,
} from "@/lib/eligibility/service";
import type { EligibilityStore } from "@/lib/eligibility/store";

export type EligibilityHttpDeps = {
  resolveUser: (tokenHash: string) => Promise<StoredUser | null>;
  store: EligibilityStore;
  source: ProfileSource;
};

function actorOf(user: StoredUser) {
  return { id: user.id, role: user.role };
}

async function readJson(request: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  const body = await readJsonObject(request);
  return body instanceof Response ? { ok: false, response: body } : { ok: true, body };
}

function fromResult(result: { ok: true } | { ok: false; status: number; message: string; fieldErrors?: Record<string, string> }, payload: unknown): Response {
  if (!result.ok) {
    return Response.json(
      { ok: false, message: result.message, fieldErrors: result.fieldErrors },
      { status: result.status },
    );
  }
  return Response.json({ ok: true, ...(payload as Record<string, unknown>) });
}

export async function getEligibilitySettings(
  request: Request,
  deps: EligibilityHttpDeps,
): Promise<Response> {
  return withRole(request, AREA_ROLES.admin, deps.resolveUser, async () => {
    const rules = await listPlatformRules(deps.store);
    return Response.json({ ok: true, rules });
  });
}

export async function putEligibilitySettings(
  request: Request,
  deps: EligibilityHttpDeps,
): Promise<Response> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) {
    return blocked;
  }
  return withRole(request, AREA_ROLES.admin, deps.resolveUser, async (user) => {
    const body = await readJson(request);
    if (!body.ok) {
      return body.response;
    }
    const result = await savePlatformRules(actorOf(user), body.body, deps.store);
    return fromResult(result, { rules: result.ok ? result.rules : undefined });
  });
}

export async function getEligibilityReviews(
  request: Request,
  deps: EligibilityHttpDeps,
): Promise<Response> {
  return withRole(request, AREA_ROLES.admin, deps.resolveUser, async () => {
    const reviews = await listManualReviews(deps.store);
    return Response.json({ ok: true, reviews });
  });
}

export async function postEligibilityReview(
  request: Request,
  deps: EligibilityHttpDeps,
): Promise<Response> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) {
    return blocked;
  }
  return withRole(request, AREA_ROLES.admin, deps.resolveUser, async (user) => {
    const body = await readJson(request);
    if (!body.ok) {
      return body.response;
    }
    const record = typeof body.body === "object" && body.body !== null ? (body.body as Record<string, unknown>) : {};
    const result = await decideReview(
      actorOf(user),
      {
        userId: record.userId,
        platform: record.platform,
        decision: record.decision,
        note: record.note,
      },
      deps.store,
    );
    return fromResult(result, { check: result.ok ? result.check : undefined });
  });
}

export async function postWorkerEligibility(
  request: Request,
  deps: EligibilityHttpDeps,
): Promise<Response> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) {
    return blocked;
  }
  return withRole(request, AREA_ROLES.worker, deps.resolveUser, async (user) => {
    const body = await readJson(request);
    if (!body.ok) {
      return body.response;
    }
    const record = typeof body.body === "object" && body.body !== null ? (body.body as Record<string, unknown>) : {};
    const result = await submitEligibilityCheck(
      actorOf(user),
      { platform: record.platform, handle: record.handle },
      deps.store,
      deps.source,
    );
    return fromResult(result, {
      check: result.ok ? result.check : undefined,
      message: result.ok ? result.message : undefined,
    });
  });
}

export async function getEligibilityAuditLogs(
  request: Request,
  deps: EligibilityHttpDeps,
): Promise<Response> {
  return withRole(request, AREA_ROLES.admin, deps.resolveUser, async () => {
    const logs = await listEligibilityAuditLogs(deps.store);
    return Response.json({ ok: true, logs });
  });
}
