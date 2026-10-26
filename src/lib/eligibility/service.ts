import { generalApiLimiter } from "@/lib/security/rate-limit";
import { AUTH_REQUIRED_MESSAGE, FORBIDDEN_MESSAGE, type UserRole } from "@/lib/auth/constants";
import { evaluateEligibility, type ProfileEvidence } from "@/lib/eligibility/evaluate";
import {
  canonicalDisplayName,
  isEligibilityPlatform,
  sortRules,
  type EligibilityPlatform,
  type PlatformRule,
} from "@/lib/eligibility/rules";
import {
  HandleTakenError,
  type EligibilityStore,
  type StoredAuditLog,
  type StoredCheck,
} from "@/lib/eligibility/store";
import { parseHandle, parseRulesOrPartial } from "@/lib/eligibility/validation";

export type EligibilityActor = {
  id: string;
  role: UserRole;
};

export type EligibilityFailure = {
  ok: false;
  status: 400 | 401 | 403 | 404 | 409 | 429;
  message: string;
  fieldErrors?: Record<string, string>;
};

export type ProfileSource = (input: {
  platform: EligibilityPlatform;
  handle: string;
}) => Promise<ProfileEvidence>;

export const unconfiguredProfileSource: ProfileSource = async () => ({
  availability: "unavailable",
});

function failure(
  status: EligibilityFailure["status"],
  message: string,
  fieldErrors?: Record<string, string>,
): EligibilityFailure {
  return { ok: false, status, message, fieldErrors };
}

function asAdmin(
  actor: EligibilityActor | null,
): { ok: true; actor: EligibilityActor } | EligibilityFailure {
  if (!actor || actor.id.trim() === "") {
    return failure(401, AUTH_REQUIRED_MESSAGE);
  }
  if (actor.role !== "ADMIN") {
    return failure(403, FORBIDDEN_MESSAGE);
  }
  return { ok: true, actor };
}

function asWorker(
  actor: EligibilityActor | null,
): { ok: true; actor: EligibilityActor } | EligibilityFailure {
  if (!actor || actor.id.trim() === "") {
    return failure(401, AUTH_REQUIRED_MESSAGE);
  }
  if (actor.role !== "WORKER") {
    return failure(403, FORBIDDEN_MESSAGE);
  }
  return { ok: true, actor };
}

function snapshot(rules: PlatformRule[]): PlatformRule[] {
  return rules.map((rule) => ({ ...rule }));
}

export async function listPlatformRules(store: EligibilityStore): Promise<PlatformRule[]> {
  return store.ensureDefaults();
}

export async function savePlatformRules(
  actor: EligibilityActor | null,
  input: unknown,
  store: EligibilityStore,
): Promise<{ ok: true; rules: PlatformRule[] } | EligibilityFailure> {
  const admin = asAdmin(actor);
  if (!admin.ok) {
    return admin;
  }
  if (!generalApiLimiter.check(`eligibility:savePlatformRules:${admin.actor.id}`).ok) return failure(429, "Too many requests. Try again shortly.");
  const before = snapshot(await store.ensureDefaults());
  const parsed = parseRulesOrPartial(input, before);
  if (!parsed.ok) {
    return failure(400, parsed.message, parsed.fieldErrors);
  }
  const after = sortRules(snapshot(parsed.rules));
  await store.saveRules(after, {
    actorUserId: admin.actor.id,
    action: "eligibility.settings.update",
    entityType: "SocialPlatformSetting",
    entityId: null,
    metadata: { before, after },
  });
  return { ok: true, rules: after };
}

function evidenceFromCheck(check: StoredCheck): ProfileEvidence {
  if (check.evidenceAvailability === "reported") {
    return {
      availability: "reported",
      accountCreatedOn: check.accountCreatedOn,
      audienceCount: check.audienceCount,
    };
  }
  if (check.evidenceAvailability === "unavailable") {
    return { availability: "unavailable" };
  }
  return { availability: "none" };
}

function resultMessage(status: StoredCheck["status"]): string {
  if (status === "ELIGIBLE") {
    return "This account meets the saved eligibility rule.";
  }
  if (status === "INELIGIBLE") {
    return "This account does not meet the saved eligibility rule.";
  }
  if (status === "MANUAL_REVIEW") {
    return "Profile data is unavailable or incomplete, so this account needs manual review.";
  }
  return "No profile data has been recorded.";
}

export async function submitEligibilityCheck(
  actor: EligibilityActor | null,
  input: { platform: unknown; handle: unknown },
  store: EligibilityStore,
  source: ProfileSource,
): Promise<{ ok: true; check: StoredCheck; message: string } | EligibilityFailure> {
  const worker = asWorker(actor);
  if (!worker.ok) {
    return worker;
  }
  if (!generalApiLimiter.check(`eligibility:submitEligibilityCheck:${worker.actor.id}`).ok) return failure(429, "Too many requests. Try again shortly.");
  if (typeof input.platform !== "string" || !isEligibilityPlatform(input.platform)) {
    return failure(400, "Choose X, Facebook, or Instagram.", {
      platform: "Choose X, Facebook, or Instagram.",
    });
  }
  const handle = parseHandle(input.handle);
  if (!handle) {
    return failure(400, "Enter a handle using letters, numbers, dots, or underscores.", {
      handle: "Enter a handle using letters, numbers, dots, or underscores.",
    });
  }
  const platform = input.platform;
  const rules = await store.ensureDefaults();
  const rule = rules.find((item) => item.platform === platform);
  if (!rule) {
    return failure(400, `${canonicalDisplayName(platform)} has no eligibility threshold saved.`);
  }
  const existing = await store.findCheck(worker.actor.id, platform);
  if (existing?.decisionSource === "ADMIN") {
    return {
      ok: true,
      check: existing,
      message: "An admin already reviewed this account. The stored decision was left unchanged.",
    };
  }

  let evidence: ProfileEvidence;
  try {
    evidence = await source({ platform, handle });
  } catch {
    evidence = { availability: "unavailable" };
  }
  if (evidence.availability === "unavailable" && existing?.evidenceAvailability === "reported") {
    evidence = evidenceFromCheck(existing);
  }

  const verdict = evaluateEligibility(rule, evidence);
  try {
    const check = await store.saveCheck({
      userId: worker.actor.id,
      platform,
      handle,
      displayName: null,
      email: null,
      status: verdict.status,
      reasons: verdict.reasons,
      accountCreatedOn: verdict.accountCreatedOn,
      audienceCount: verdict.audienceCount,
      evidenceAvailability: evidence.availability,
      markVerified: verdict.status === "ELIGIBLE",
    });
    return { ok: true, check, message: resultMessage(check.status) };
  } catch (error) {
    if (error instanceof HandleTakenError) {
      return failure(409, error.message, { handle: error.message });
    }
    throw error;
  }
}

export async function decideReview(
  actor: EligibilityActor | null,
  input: { userId: unknown; platform: unknown; decision: unknown; note: unknown },
  store: EligibilityStore,
): Promise<{ ok: true; check: StoredCheck } | EligibilityFailure> {
  const admin = asAdmin(actor);
  if (!admin.ok) {
    return admin;
  }
  if (!generalApiLimiter.check(`eligibility:review:${admin.actor.id}`).ok) return failure(429, "Too many requests. Try again shortly.");
  if (typeof input.userId !== "string" || input.userId.trim() === "") {
    return failure(400, "Choose an account to review.");
  }
  if (typeof input.platform !== "string" || !isEligibilityPlatform(input.platform)) {
    return failure(400, "Choose X, Facebook, or Instagram.");
  }
  if (input.decision !== "approve" && input.decision !== "reject") {
    return failure(400, "Choose approve or reject.");
  }
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length < 10 || note.length > 500) {
    return failure(400, "Write a review note of at least 10 characters.", {
      note: "Write a review note of at least 10 characters.",
    });
  }
  const displayName = canonicalDisplayName(input.platform);
  const approved = input.decision === "approve";
  const reasons = approved
    ? [
        `${displayName} was approved by an admin. No creation date or audience count was added.`,
        note,
      ]
    : [`${displayName} was rejected by an admin.`, note];
  const check = await store.applyReview(
    {
      userId: input.userId.trim(),
      platform: input.platform,
      status: approved ? "ELIGIBLE" : "INELIGIBLE",
      reasons,
      reviewNote: note,
      reviewedById: admin.actor.id,
    },
    {
      actorUserId: admin.actor.id,
      action: approved ? "eligibility.review.approve" : "eligibility.review.reject",
      entityType: "SocialEligibility",
      entityId: `${input.userId.trim()}:${input.platform}`,
      metadata: {
        platform: input.platform,
        decision: input.decision,
        note,
        metricsAdded: false,
      },
    },
  );
  if (!check) {
    return failure(404, "No eligibility record exists for that account.");
  }
  return { ok: true, check };
}

export async function listManualReviews(store: EligibilityStore): Promise<StoredCheck[]> {
  return store.listOpenReviews();
}

export async function listEligibilityAuditLogs(store: EligibilityStore): Promise<StoredAuditLog[]> {
  return store.listAuditLogs();
}
