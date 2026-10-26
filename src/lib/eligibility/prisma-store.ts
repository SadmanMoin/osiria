import { Prisma } from "@/generated/prisma/client";
import type { ProfileEvidence } from "@/lib/eligibility/evaluate";
import {
  canonicalDisplayName,
  DEFAULT_PLATFORM_RULES,
  DEFAULT_RULE_IDS,
  ELIGIBILITY_PLATFORMS,
  isEligibilityPlatform,
  sortRules,
  type EligibilityPlatform,
  type EligibilityStatus,
  type PlatformRule,
} from "@/lib/eligibility/rules";
import {
  HandleTakenError,
  type ApplyReviewInput,
  type AuditRecord,
  type EligibilityStore,
  type SaveCheckInput,
  type StoredAuditLog,
  type StoredCheck,
} from "@/lib/eligibility/store";
import { getPrisma } from "@/lib/db/prisma";

const INVALID_RECORD = "Stored eligibility data is invalid.";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

function formatUtcDate(value: Date | null): string | null {
  if (!value) {
    return null;
  }
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseUtcDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  return new Date(`${value}T00:00:00.000Z`);
}

function toRule(row: {
  platform: string;
  isEnabled: boolean;
  minFollowers: number | null;
  accountCreatedOnOrBefore: Date | null;
  ruleJoin: string;
  audienceMetric: string;
}): PlatformRule {
  if (!isEligibilityPlatform(row.platform)) {
    throw new Error(INVALID_RECORD);
  }
  if (row.ruleJoin !== "OR" && row.ruleJoin !== "AND") {
    throw new Error(INVALID_RECORD);
  }
  if (row.audienceMetric !== "FOLLOWERS" && row.audienceMetric !== "FRIENDS") {
    throw new Error(INVALID_RECORD);
  }
  if (row.minFollowers !== null && (!Number.isInteger(row.minFollowers) || row.minFollowers < 0)) {
    throw new Error(INVALID_RECORD);
  }
  return {
    platform: row.platform,
    displayName: canonicalDisplayName(row.platform),
    isEnabled: row.isEnabled,
    accountCreatedOnOrBefore: formatUtcDate(row.accountCreatedOnOrBefore),
    minAudience: row.minFollowers,
    ruleJoin: row.ruleJoin,
    audienceMetric: row.audienceMetric,
  };
}

function readReasons(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(INVALID_RECORD);
  }
  return value as string[];
}

function readStatus(value: string): EligibilityStatus {
  if (
    value === "PENDING_VERIFICATION" ||
    value === "ELIGIBLE" ||
    value === "INELIGIBLE" ||
    value === "MANUAL_REVIEW"
  ) {
    return value;
  }
  throw new Error(INVALID_RECORD);
}

function readAvailability(value: string): ProfileEvidence["availability"] {
  if (value === "NONE") {
    return "none";
  }
  if (value === "UNAVAILABLE") {
    return "unavailable";
  }
  if (value === "REPORTED") {
    return "reported";
  }
  throw new Error(INVALID_RECORD);
}

function writeAvailability(value: ProfileEvidence["availability"]): "NONE" | "UNAVAILABLE" | "REPORTED" {
  if (value === "none") {
    return "NONE";
  }
  if (value === "unavailable") {
    return "UNAVAILABLE";
  }
  return "REPORTED";
}

function toCheck(row: {
  id: string;
  userId: string;
  platform: string;
  status: string;
  reasons: Prisma.JsonValue;
  accountCreatedOn: Date | null;
  audienceCount: number | null;
  evidenceAvailability: string;
  reviewNote: string | null;
  reviewedById: string | null;
  decisionSource: string;
  socialAccountId: string | null;
  user: { displayName: string; email: string };
  socialAccount: { handle: string } | null;
}): StoredCheck {
  if (!isEligibilityPlatform(row.platform)) {
    throw new Error(INVALID_RECORD);
  }
  if (row.decisionSource !== "RULES" && row.decisionSource !== "ADMIN") {
    throw new Error(INVALID_RECORD);
  }
  if (row.audienceCount !== null && !Number.isInteger(row.audienceCount)) {
    throw new Error(INVALID_RECORD);
  }
  return {
    id: row.id,
    userId: row.userId,
    platform: row.platform,
    status: readStatus(row.status),
    reasons: readReasons(row.reasons),
    accountCreatedOn: formatUtcDate(row.accountCreatedOn),
    audienceCount: row.audienceCount,
    evidenceAvailability: readAvailability(row.evidenceAvailability),
    reviewNote: row.reviewNote,
    reviewedById: row.reviewedById,
    decisionSource: row.decisionSource,
    socialAccountId: row.socialAccountId,
    handle: row.socialAccount?.handle ?? null,
    displayName: row.user.displayName,
    email: row.user.email,
  };
}

const checkInclude = {
  user: { select: { displayName: true, email: true } },
  socialAccount: { select: { handle: true } },
} as const;

function auditData(audit: AuditRecord) {
  return {
    actorUserId: audit.actorUserId,
    action: audit.action,
    entityType: audit.entityType,
    entityId: audit.entityId,
    metadata: audit.metadata as Prisma.InputJsonValue,
  };
}

export class PrismaEligibilityStore implements EligibilityStore {
  async ensureDefaults(): Promise<PlatformRule[]> {
    const prisma = getPrisma();
    const existing = await prisma.socialPlatformSetting.findMany({
      where: { platform: { in: [...ELIGIBILITY_PLATFORMS] } },
    });
    const present = new Set(existing.map((row) => row.platform));
    for (const rule of DEFAULT_PLATFORM_RULES) {
      if (present.has(rule.platform)) {
        continue;
      }
      try {
        await prisma.socialPlatformSetting.create({
          data: {
            id: DEFAULT_RULE_IDS[rule.platform],
            platform: rule.platform,
            displayName: rule.displayName,
            isEnabled: rule.isEnabled,
            verificationRequired: true,
            minFollowers: rule.minAudience,
            accountCreatedOnOrBefore: parseUtcDate(rule.accountCreatedOnOrBefore),
            ruleJoin: rule.ruleJoin,
            audienceMetric: rule.audienceMetric,
          },
        });
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
      }
    }
    const rows = await prisma.socialPlatformSetting.findMany({
      where: { platform: { in: [...ELIGIBILITY_PLATFORMS] } },
    });
    return sortRules(rows.map(toRule));
  }

  async saveRules(rules: PlatformRule[], audit: AuditRecord): Promise<void> {
    await this.ensureDefaults();
    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      for (const rule of rules) {
        await tx.socialPlatformSetting.update({
          where: { platform: rule.platform },
          data: {
            displayName: canonicalDisplayName(rule.platform),
            isEnabled: rule.isEnabled,
            minFollowers: rule.minAudience,
            accountCreatedOnOrBefore: parseUtcDate(rule.accountCreatedOnOrBefore),
            ruleJoin: rule.ruleJoin,
            audienceMetric: rule.audienceMetric,
          },
        });
      }
      await tx.adminAuditLog.create({ data: auditData(audit) });
    }, { isolationLevel: "Serializable" });
  }

  async findCheck(userId: string, platform: EligibilityPlatform): Promise<StoredCheck | null> {
    const row = await getPrisma().socialEligibility.findUnique({
      where: { userId_platform: { userId, platform } },
      include: checkInclude,
    });
    return row ? toCheck(row) : null;
  }

  async saveCheck(input: SaveCheckInput): Promise<StoredCheck> {
    const prisma = getPrisma();
    try {
      const row = await prisma.$transaction(async (tx) => {
        // Recheck inside the transaction: a review may have committed after the service read.
        const current = await tx.socialEligibility.findUnique({
          where: { userId_platform: { userId: input.userId, platform: input.platform } },
          include: checkInclude,
        });
        if (current?.decisionSource === "ADMIN") return current;
        const owner = await tx.socialAccount.findFirst({
          where: {
            platform: input.platform,
            handle: { equals: input.handle, mode: "insensitive" },
            NOT: { userId: input.userId },
          },
          select: { id: true },
        });
        if (owner) {
          throw new HandleTakenError();
        }
        const account = await tx.socialAccount.upsert({
          where: { userId_platform: { userId: input.userId, platform: input.platform } },
          create: {
            userId: input.userId,
            platform: input.platform,
            handle: input.handle,
            status: input.markVerified ? "ACTIVE" : "PENDING",
            verifiedAt: input.markVerified ? new Date() : null,
          },
          update: {
            handle: input.handle,
            status: input.markVerified ? "ACTIVE" : "PENDING",
            verifiedAt: input.markVerified ? new Date() : null,
          },
        });
        return tx.socialEligibility.upsert({
          where: { userId_platform: { userId: input.userId, platform: input.platform } },
          create: {
            userId: input.userId,
            platform: input.platform,
            status: input.status,
            reasons: input.reasons,
            accountCreatedOn: parseUtcDate(input.accountCreatedOn),
            audienceCount: input.audienceCount,
            evidenceAvailability: writeAvailability(input.evidenceAvailability),
            decisionSource: "RULES",
            socialAccountId: account.id,
          },
          update: {
            status: input.status,
            reasons: input.reasons,
            accountCreatedOn: parseUtcDate(input.accountCreatedOn),
            audienceCount: input.audienceCount,
            evidenceAvailability: writeAvailability(input.evidenceAvailability),
            reviewNote: null,
            reviewedById: null,
            reviewedAt: null,
            decisionSource: "RULES",
            socialAccountId: account.id,
          },
          include: checkInclude,
        });
      }, { isolationLevel: "Serializable" });
      return toCheck(row);
    } catch (error) {
      if (error instanceof HandleTakenError || isUniqueViolation(error)) {
        throw new HandleTakenError();
      }
      throw error;
    }
  }

  async listOpenReviews(): Promise<StoredCheck[]> {
    const rows = await getPrisma().socialEligibility.findMany({
      where: {
        status: { in: ["MANUAL_REVIEW", "PENDING_VERIFICATION"] },
        platform: { in: [...ELIGIBILITY_PLATFORMS] },
      },
      include: checkInclude,
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    return rows.map(toCheck);
  }

  async applyReview(input: ApplyReviewInput, audit: AuditRecord): Promise<StoredCheck | null> {
    const prisma = getPrisma();
    return prisma.$transaction(async (tx) => {
      const current = await tx.socialEligibility.findUnique({
        where: { userId_platform: { userId: input.userId, platform: input.platform } },
        select: { id: true, socialAccountId: true },
      });
      if (!current) {
        return null;
      }
      const row = await tx.socialEligibility.update({
        where: { id: current.id },
        data: {
          status: input.status,
          reasons: input.reasons,
          reviewNote: input.reviewNote,
          reviewedById: input.reviewedById,
          reviewedAt: new Date(),
          decisionSource: "ADMIN",
        },
        include: checkInclude,
      });
      if (current.socialAccountId) {
        await tx.socialAccount.update({
          where: { id: current.socialAccountId },
          data:
            input.status === "ELIGIBLE"
              ? { status: "ACTIVE", verifiedAt: new Date() }
              : { status: "PENDING", verifiedAt: null },
        });
      }
      await tx.adminAuditLog.create({ data: auditData(audit) });
      return toCheck(row);
    }, { isolationLevel: "Serializable" });
  }

  async listAuditLogs(): Promise<StoredAuditLog[]> {
    const rows = await getPrisma().adminAuditLog.findMany({
      where: {
        action: {
          startsWith: "eligibility.",
        },
      },
      include: {
        actor: { select: { displayName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map((row) => ({
      id: row.id,
      actorUserId: row.actorUserId,
      actorEmail: row.actor.email,
      actorName: row.actor.displayName,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      metadata: (row.metadata as Record<string, unknown>) ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}

export function getEligibilityStore(): EligibilityStore {
  return new PrismaEligibilityStore();
}
