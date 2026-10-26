import type { ProfileEvidence } from "@/lib/eligibility/evaluate";
import type {
  EligibilityPlatform,
  EligibilityStatus,
  PlatformRule,
} from "@/lib/eligibility/rules";

export class HandleTakenError extends Error {
  constructor() {
    super("That handle is already linked to another account.");
    this.name = "HandleTakenError";
  }
}

export type AuditRecord = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
};

export type StoredCheck = {
  id: string;
  userId: string;
  platform: EligibilityPlatform;
  status: EligibilityStatus;
  reasons: string[];
  accountCreatedOn: string | null;
  audienceCount: number | null;
  evidenceAvailability: ProfileEvidence["availability"];
  reviewNote: string | null;
  reviewedById: string | null;
  decisionSource: "RULES" | "ADMIN";
  socialAccountId: string | null;
  handle: string | null;
  displayName: string | null;
  email: string | null;
};

export type SaveCheckInput = {
  userId: string;
  platform: EligibilityPlatform;
  handle: string;
  displayName: string | null;
  email: string | null;
  status: EligibilityStatus;
  reasons: string[];
  accountCreatedOn: string | null;
  audienceCount: number | null;
  evidenceAvailability: ProfileEvidence["availability"];
  markVerified: boolean;
};

export type ApplyReviewInput = {
  userId: string;
  platform: EligibilityPlatform;
  status: "ELIGIBLE" | "INELIGIBLE";
  reasons: string[];
  reviewNote: string;
  reviewedById: string;
};

export type StoredAuditLog = {
  id: string;
  actorUserId: string;
  actorEmail?: string;
  actorName?: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export interface EligibilityStore {
  ensureDefaults(): Promise<PlatformRule[]>;
  saveRules(rules: PlatformRule[], audit: AuditRecord): Promise<void>;
  findCheck(userId: string, platform: EligibilityPlatform): Promise<StoredCheck | null>;
  saveCheck(input: SaveCheckInput): Promise<StoredCheck>;
  listOpenReviews(): Promise<StoredCheck[]>;
  applyReview(input: ApplyReviewInput, audit: AuditRecord): Promise<StoredCheck | null>;
  listAuditLogs(): Promise<StoredAuditLog[]>;
}
