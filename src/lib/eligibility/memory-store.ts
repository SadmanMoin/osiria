import { DEFAULT_PLATFORM_RULES, sortRules, type PlatformRule } from "@/lib/eligibility/rules";
import {
  HandleTakenError,
  type ApplyReviewInput,
  type AuditRecord,
  type EligibilityStore,
  type SaveCheckInput,
  type StoredAuditLog,
  type StoredCheck,
} from "@/lib/eligibility/store";

function cloneRule(rule: PlatformRule): PlatformRule {
  return { ...rule };
}

export class MemoryEligibilityStore implements EligibilityStore {
  rules: PlatformRule[] = DEFAULT_PLATFORM_RULES.map(cloneRule);
  checks: StoredCheck[] = [];
  audits: AuditRecord[] = [];
  private sequence = 0;

  async ensureDefaults(): Promise<PlatformRule[]> {
    return sortRules(this.rules.map(cloneRule));
  }

  async saveRules(rules: PlatformRule[], audit: AuditRecord): Promise<void> {
    this.rules = sortRules(rules.map(cloneRule));
    this.audits.push(audit);
  }

  async findCheck(userId: string, platform: SaveCheckInput["platform"]): Promise<StoredCheck | null> {
    return this.checks.find((check) => check.userId === userId && check.platform === platform) ?? null;
  }

  async saveCheck(input: SaveCheckInput): Promise<StoredCheck> {
    const owner = this.checks.find(
      (check) =>
        check.platform === input.platform &&
        check.handle === input.handle &&
        check.userId !== input.userId,
    );
    if (owner) {
      throw new HandleTakenError();
    }
    const current = await this.findCheck(input.userId, input.platform);
    const next: StoredCheck = {
      id: current?.id ?? `check-${++this.sequence}`,
      userId: input.userId,
      platform: input.platform,
      status: input.status,
      reasons: [...input.reasons],
      accountCreatedOn: input.accountCreatedOn,
      audienceCount: input.audienceCount,
      evidenceAvailability: input.evidenceAvailability,
      reviewNote: null,
      reviewedById: null,
      decisionSource: "RULES",
      socialAccountId: current?.socialAccountId ?? `account-${input.userId}-${input.platform}`,
      handle: input.handle,
      displayName: input.displayName,
      email: input.email,
    };
    this.checks = this.checks.filter(
      (check) => !(check.userId === input.userId && check.platform === input.platform),
    );
    this.checks.push(next);
    return next;
  }

  async listOpenReviews(): Promise<StoredCheck[]> {
    return this.checks.filter(
      (check) => check.status === "MANUAL_REVIEW" || check.status === "PENDING_VERIFICATION",
    );
  }

  async applyReview(input: ApplyReviewInput, audit: AuditRecord): Promise<StoredCheck | null> {
    const current = await this.findCheck(input.userId, input.platform);
    if (!current) {
      return null;
    }
    const next: StoredCheck = {
      ...current,
      status: input.status,
      reasons: [...input.reasons],
      reviewNote: input.reviewNote,
      reviewedById: input.reviewedById,
      decisionSource: "ADMIN",
    };
    this.checks = this.checks.map((check) => (check.id === current.id ? next : check));
    this.audits.push(audit);
    return next;
  }

  async listAuditLogs(): Promise<StoredAuditLog[]> {
    return this.audits
      .map((a, i) => ({
        id: `audit-${i + 1}`,
        actorUserId: a.actorUserId,
        actorEmail: "admin@example.com",
        actorName: "Admin",
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        metadata: a.metadata,
        createdAt: new Date().toISOString(),
      }))
      .reverse();
  }
}
