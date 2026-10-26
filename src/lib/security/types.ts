import type {
  CampaignPlatform,
} from "@/lib/campaigns/types";

export type FraudType =
  | "DUPLICATE_SUBMISSION"
  | "VELOCITY"
  | "ACCOUNT_MISMATCH"
  | "MANUAL_REVIEW";

export type FraudSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type StoredFraudEvent = {
  resolvedAt?: string | null;
  resolution?: string | null;
  id: string;
  userId: string | null;
  userEmail?: string | null;
  userDisplayName?: string | null;
  submissionId: string | null;
  type: FraudType;
  severity: FraudSeverity;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export type SecurityEvaluationResult = {
  flagged: boolean;
  severity: FraudSeverity;
  reasons: string[];
  fraudType?: FraudType;
  details?: Record<string, unknown>;
};

export type StoredAuditLog = {
  id: string;
  actorUserId: string;
  actorEmail?: string;
  actorDisplayName?: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type RateLimitDecision =
  | { ok: true; remaining: number; limit: number; resetAtMs: number }
  | { ok: false; remaining: 0; limit: number; resetAtMs: number; retryAfterSeconds: number };

export type ProofSubmissionContext = {
  taskId: string;
  taskPlatform: CampaignPlatform;
  userId: string;
  proofUrl: string;
  workerHandle?: string;
};
