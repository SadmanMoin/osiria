export type CampaignPlatform =
  | "X"
  | "FACEBOOK"
  | "INSTAGRAM"
  | "TIKTOK"
  | "YOUTUBE"
  | "THREADS"
  | "LINKEDIN";

export type CampaignStatus = "DRAFT" | "OPEN" | "PAUSED" | "CLOSED";
export type CampaignTaskStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "CLOSED";
export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED" | "APPEALED" | "FLAGGED";
export type BudgetReason = "FUND" | "RESERVE" | "RELEASE" | "PAYOUT" | "ADJUSTMENT";
export type PointsReason = "TASK_REWARD" | "ADJUSTMENT" | "CLAWBACK";
export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type StoredCampaignTask = {
  id: string;
  campaignId: string;
  platform: CampaignPlatform;
  title: string;
  instructions: string;
  rewardPoints: number;
  rewardAmountMinor: number;
  slotsTotal: number;
  slotsFilled: number;
  status: CampaignTaskStatus;
  createdAt: string;
  updatedAt: string;
};

export type CampaignBudgetSummary = {
  campaignId: string;
  budgetCapMinor: number;
  totalFundedMinor: number;
  totalPaidMinor: number;
  totalReservedMinor: number;
  availableBudgetMinor: number;
};

export type StoredCampaign = {
  id: string;
  ownerId: string;
  ownerName: string;
  slug: string;
  title: string;
  description: string;
  status: CampaignStatus;
  budgetMinor: number;
  currency: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
  tasks: StoredCampaignTask[];
  budgetSummary: CampaignBudgetSummary;
};

export type StoredSubmission = {
  id: string;
  taskId: string;
  taskTitle: string;
  taskPlatform: CampaignPlatform;
  rewardPoints: number;
  rewardAmountMinor: number;
  campaignId: string;
  campaignTitle: string;
  campaignOwnerId: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  socialAccountId: string;
  socialPlatform: CampaignPlatform;
  socialHandle: string;
  status: SubmissionStatus;
  proofUrl: string;
  reviewerNote: string | null;
  rejectionReason: string | null;
  appealReason: string | null;
  appealedAt: string | null;
  appealReviewNote: string | null;
  reviewedById: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  createdAt: string;
};

export type PointsHistoryEntry = {
  id: string;
  userId: string;
  deltaPoints: number;
  reason: PointsReason;
  campaignId: string | null;
  campaignTitle: string | null;
  submissionId: string | null;
  note: string | null;
  createdAt: string;
};

export type WorkerPointsSummary = {
  userId: string;
  currentBalance: number;
  totalEarned: number;
  totalEntries: number;
};

export type AdvertiserFundsSummary = {
  userId: string;
  totalDepositedMinor: number;
  totalAllocatedMinor: number;
  pendingDepositsMinor: number;
  availableBalanceMinor: number;
};

export type CreateCampaignInput = {
  ownerId: string;
  title: string;
  slug: string;
  description: string;
  budgetMinor: number;
  currency?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  tasks: {
    platform: CampaignPlatform;
    title: string;
    instructions: string;
    rewardPoints: number;
    rewardAmountMinor: number;
    slotsTotal: number;
  }[];
};

export type FundCampaignInput = {
  campaignId: string;
  amountMinor: number;
  note?: string;
  paymentId?: string;
};

export type CreateSubmissionInput = {
  taskId: string;
  userId: string;
  proofUrl: string;
};

export type ReviewSubmissionInput = {
  submissionId: string;
  reviewerId: string;
  decision: "approve" | "reject";
  note?: string;
  rejectionReason?: string;
};

export type AppealSubmissionInput = {
  submissionId: string;
  userId: string;
  appealReason: string;
};

export type DecideAppealInput = {
  submissionId: string;
  reviewerId: string;
  decision: "overturn" | "uphold";
  note: string;
};

export type ModerateCampaignInput = {
  campaignId: string;
  moderatorId: string;
  action: "approve" | "pause" | "close" | "resume";
  note?: string;
};
