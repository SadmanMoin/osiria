import type {
  AdvertiserFundsSummary,
  AppealSubmissionInput,
  CampaignBudgetSummary,
  CampaignStatus,
  CreateCampaignInput,
  CreateSubmissionInput,
  DecideAppealInput,
  FundCampaignInput,
  ModerateCampaignInput,
  PaymentStatus,
  PointsHistoryEntry,
  ReviewSubmissionInput,
  StoredCampaign,
  StoredCampaignTask,
  StoredSubmission,
  SubmissionStatus,
  WorkerPointsSummary,
} from "@/lib/campaigns/types";

export class CampaignError extends Error {
  constructor(message: string, public readonly status: number = 400) {
    super(message);
    this.name = "CampaignError";
  }
}

export class DuplicateSubmissionError extends CampaignError {
  constructor(message = "You have already submitted proof for this task.") {
    super(message, 409);
    this.name = "DuplicateSubmissionError";
  }
}

export class SlotLimitError extends CampaignError {
  constructor(message = "All available slots for this task are filled.") {
    super(message, 400);
    this.name = "SlotLimitError";
  }
}

export class InsufficientBudgetError extends CampaignError {
  constructor(message = "The campaign has insufficient funded budget to cover this reward.") {
    super(message, 400);
    this.name = "InsufficientBudgetError";
  }
}

export class InvalidStateError extends CampaignError {
  constructor(message: string) {
    super(message, 400);
    this.name = "InvalidStateError";
  }
}

export class IneligibleSocialAccountError extends CampaignError {
  constructor(message = "You do not have an active, eligible social account for this platform.") {
    super(message, 400);
    this.name = "IneligibleSocialAccountError";
  }
}

export class FraudFlaggedError extends CampaignError {
  constructor(message = "This submission has been flagged for security review.") {
    super(message, 422);
    this.name = "FraudFlaggedError";
  }
}

export interface CampaignStore {
  createCampaign(input: CreateCampaignInput): Promise<StoredCampaign>;
  findCampaignById(id: string): Promise<StoredCampaign | null>;
  findCampaignBySlug(slug: string): Promise<StoredCampaign | null>;
  listCampaigns(filters?: { status?: CampaignStatus; ownerId?: string }): Promise<StoredCampaign[]>;
  moderateCampaign(input: ModerateCampaignInput): Promise<StoredCampaign | null>;

  findTaskById(id: string): Promise<StoredCampaignTask | null>;

  getCampaignBudgetSummary(campaignId: string): Promise<CampaignBudgetSummary>;
  fundCampaign(input: FundCampaignInput): Promise<CampaignBudgetSummary>;

  createSubmission(input: CreateSubmissionInput, socialAccountId: string): Promise<StoredSubmission>;
  findSubmissionById(id: string): Promise<StoredSubmission | null>;
  findSubmissionByUserAndTask(userId: string, taskId: string): Promise<StoredSubmission | null>;
  listSubmissions(filters?: {
    userId?: string;
    campaignId?: string;
    ownerId?: string;
    status?: SubmissionStatus;
  }): Promise<StoredSubmission[]>;
  reviewSubmission(input: ReviewSubmissionInput): Promise<StoredSubmission>;
  appealSubmission(input: AppealSubmissionInput): Promise<StoredSubmission>;
  decideAppeal(input: DecideAppealInput): Promise<StoredSubmission>;

  getWorkerPointsSummary(userId: string): Promise<WorkerPointsSummary>;
  listWorkerPointsHistory(userId: string): Promise<PointsHistoryEntry[]>;

  getAdvertiserFundsSummary(userId: string): Promise<AdvertiserFundsSummary>;
  createDepositIntent(
    userId: string,
    amountMinor: number,
    externalReference?: string,
  ): Promise<{ paymentId: string; status: PaymentStatus }>;

  listFraudEvents(filters?: { userId?: string; severity?: string }): Promise<any[]>; // eslint-disable-line @typescript-eslint/no-explicit-any
  resolveFraudEvent(
    eventId: string,
    action: "DISMISS" | "CONFIRM",
    adminId: string,
    note?: string,
  ): Promise<{ ok: boolean; message: string }>;
}
