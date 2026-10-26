import {
  DuplicateSubmissionError,
  IneligibleSocialAccountError,
  InsufficientBudgetError,
  InvalidStateError,
  SlotLimitError,
  type CampaignStore,
} from "@/lib/campaigns/store";
import { evaluateSubmissionSecurity } from "@/lib/security/fraud";
import type { StoredFraudEvent } from "@/lib/security/types";
import type {
  AdvertiserFundsSummary,
  AppealSubmissionInput,
  BudgetReason,
  CampaignBudgetSummary,
  CampaignPlatform,
  CampaignStatus,
  CreateCampaignInput,
  CreateSubmissionInput,
  DecideAppealInput,
  FundCampaignInput,
  ModerateCampaignInput,
  PaymentStatus,
  PointsHistoryEntry,
  PointsReason,
  ReviewSubmissionInput,
  StoredCampaign,
  StoredCampaignTask,
  StoredSubmission,
  SubmissionStatus,
  WorkerPointsSummary,
} from "@/lib/campaigns/types";

type BudgetEntry = {
  id: string;
  campaignId: string;
  amountMinor: number;
  reason: BudgetReason;
  paymentId?: string;
  submissionId?: string;
  note?: string;
  createdAt: string;
};

type PointsEntry = {
  id: string;
  userId: string;
  deltaPoints: number;
  reason: PointsReason;
  campaignId?: string;
  submissionId?: string;
  note?: string;
  createdAt: string;
};

type PaymentRecord = {
  id: string;
  userId: string;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  externalReference?: string;
  createdAt: string;
};

type UserProfile = {
  id: string;
  displayName: string;
  email: string;
};

type SocialProfile = {
  id: string;
  userId: string;
  platform: CampaignPlatform;
  handle: string;
  status: "ACTIVE" | "PENDING" | "REVOKED";
};

export class MemoryCampaignStore implements CampaignStore {
  campaigns: StoredCampaign[] = [];
  tasks: StoredCampaignTask[] = [];
  budgetEntries: BudgetEntry[] = [];
  submissions: StoredSubmission[] = [];
  pointsEntries: PointsEntry[] = [];
  payments: PaymentRecord[] = [];
  fraudEvents: StoredFraudEvent[] = [];
  users: Map<string, UserProfile> = new Map();
  socialAccounts: Map<string, SocialProfile> = new Map();
  private seq = 0;
  private locks: Map<string, Promise<void>> = new Map();

  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(key, current);
    try {
      await prev;
    } catch {
      // ignore previous failure
    }
    try {
      return await fn();
    } finally {
      release();
    }
  }

  // Mock helper to register a test user
  registerUser(user: UserProfile) {
    this.users.set(user.id, user);
  }

  // Mock helper to register a verified social account
  registerSocialAccount(account: SocialProfile) {
    this.socialAccounts.set(`${account.userId}:${account.platform}`, account);
  }

  async createCampaign(input: CreateCampaignInput): Promise<StoredCampaign> {
    const existingSlug = this.campaigns.find((c) => c.slug === input.slug);
    if (existingSlug) {
      throw new InvalidStateError("Campaign slug is already taken.");
    }

    const campaignId = `camp-${++this.seq}`;
    const user = this.users.get(input.ownerId);
    const now = new Date().toISOString();

    const createdTasks: StoredCampaignTask[] = input.tasks.map((taskInput, idx) => ({
      id: `task-${campaignId}-${idx + 1}`,
      campaignId,
      platform: taskInput.platform,
      title: taskInput.title,
      instructions: taskInput.instructions,
      rewardPoints: taskInput.rewardPoints,
      rewardAmountMinor: taskInput.rewardAmountMinor,
      slotsTotal: taskInput.slotsTotal,
      slotsFilled: 0,
      status: "DRAFT",
      createdAt: now,
      updatedAt: now,
    }));

    this.tasks.push(...createdTasks);

    const campaign: StoredCampaign = {
      id: campaignId,
      ownerId: input.ownerId,
      ownerName: user?.displayName ?? "Advertiser",
      slug: input.slug,
      title: input.title,
      description: input.description,
      status: "DRAFT",
      budgetMinor: input.budgetMinor,
      currency: input.currency ?? "USD",
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      createdAt: now,
      updatedAt: now,
      tasks: createdTasks,
      budgetSummary: {
        campaignId,
        budgetCapMinor: input.budgetMinor,
        totalFundedMinor: 0,
        totalPaidMinor: 0,
        totalReservedMinor: 0,
        availableBudgetMinor: 0,
      },
    };

    this.campaigns.push(campaign);
    return campaign;
  }

  async findCampaignById(id: string): Promise<StoredCampaign | null> {
    const campaign = this.campaigns.find((c) => c.id === id);
    if (!campaign) return null;
    const tasks = this.tasks.filter((t) => t.campaignId === id);
    const budgetSummary = await this.getCampaignBudgetSummary(id);
    return { ...campaign, tasks, budgetSummary };
  }

  async findCampaignBySlug(slug: string): Promise<StoredCampaign | null> {
    const campaign = this.campaigns.find((c) => c.slug === slug);
    if (!campaign) return null;
    const tasks = this.tasks.filter((t) => t.campaignId === campaign.id);
    const budgetSummary = await this.getCampaignBudgetSummary(campaign.id);
    return { ...campaign, tasks, budgetSummary };
  }

  async listCampaigns(filters?: { status?: CampaignStatus; ownerId?: string }): Promise<StoredCampaign[]> {
    let result = [...this.campaigns];
    if (filters?.status) {
      result = result.filter((c) => c.status === filters.status);
    }
    if (filters?.ownerId) {
      result = result.filter((c) => c.ownerId === filters.ownerId);
    }
    return Promise.all(
      result.map(async (c) => {
        const tasks = this.tasks.filter((t) => t.campaignId === c.id);
        const budgetSummary = await this.getCampaignBudgetSummary(c.id);
        return { ...c, tasks, budgetSummary };
      }),
    );
  }

  async moderateCampaign(input: ModerateCampaignInput): Promise<StoredCampaign | null> {
    const campaign = this.campaigns.find((c) => c.id === input.campaignId);
    if (!campaign) return null;

    let nextStatus: CampaignStatus = campaign.status;
    let nextTaskStatus: StoredCampaignTask["status"] = "DRAFT";

    if (input.action === "approve") {
      nextStatus = "OPEN";
      nextTaskStatus = "ACTIVE";
    } else if (input.action === "pause") {
      nextStatus = "PAUSED";
      nextTaskStatus = "PAUSED";
    } else if (input.action === "resume") {
      nextStatus = "OPEN";
      nextTaskStatus = "ACTIVE";
    } else if (input.action === "close") {
      nextStatus = "CLOSED";
      nextTaskStatus = "CLOSED";
    }

    campaign.status = nextStatus;
    campaign.updatedAt = new Date().toISOString();

    for (const task of this.tasks) {
      if (task.campaignId === campaign.id) {
        task.status = nextTaskStatus;
        task.updatedAt = campaign.updatedAt;
      }
    }

    return this.findCampaignById(campaign.id);
  }

  async findTaskById(id: string): Promise<StoredCampaignTask | null> {
    return this.tasks.find((t) => t.id === id) ?? null;
  }

  async getCampaignBudgetSummary(campaignId: string): Promise<CampaignBudgetSummary> {
    const campaign = this.campaigns.find((c) => c.id === campaignId);
    const entries = this.budgetEntries.filter((b) => b.campaignId === campaignId);

    let totalFunded = 0;
    let totalPaid = 0;
    let totalReserved = 0;

    for (const e of entries) {
      if (e.reason === "FUND") {
        totalFunded += e.amountMinor;
      } else if (e.reason === "PAYOUT") {
        totalPaid += Math.abs(e.amountMinor);
      } else if (e.reason === "RESERVE") {
        totalReserved += Math.abs(e.amountMinor);
      } else if (e.reason === "RELEASE") {
        totalReserved -= Math.abs(e.amountMinor);
      }
    }

    const available = totalFunded - totalPaid - totalReserved;

    return {
      campaignId,
      budgetCapMinor: campaign?.budgetMinor ?? 0,
      totalFundedMinor: totalFunded,
      totalPaidMinor: totalPaid,
      totalReservedMinor: totalReserved,
      availableBudgetMinor: available,
    };
  }

  async fundCampaign(input: FundCampaignInput): Promise<CampaignBudgetSummary> {
    if (input.amountMinor <= 0) {
      throw new InvalidStateError("Fund amount must be positive.");
    }
    const campaign = this.campaigns.find((c) => c.id === input.campaignId);
    if (!campaign) {
      throw new InvalidStateError("Campaign not found.");
    }

    this.budgetEntries.push({
      id: `budget-${++this.seq}`,
      campaignId: input.campaignId,
      amountMinor: input.amountMinor,
      reason: "FUND",
      paymentId: input.paymentId,
      note: input.note ?? "Campaign funding deposit",
      createdAt: new Date().toISOString(),
    });

    return this.getCampaignBudgetSummary(input.campaignId);
  }

  async createSubmission(input: CreateSubmissionInput, socialAccountId: string): Promise<StoredSubmission> {
    const task = this.tasks.find((t) => t.id === input.taskId);
    if (!task) {
      throw new InvalidStateError("Task not found.");
    }
    const campaign = this.campaigns.find((c) => c.id === task.campaignId);
    if (!campaign || campaign.status !== "OPEN" || task.status !== "ACTIVE") {
      throw new InvalidStateError("This task is not open for submissions.");
    }

    if (task.slotsFilled >= task.slotsTotal) {
      throw new SlotLimitError();
    }

    const existing = this.submissions.find((s) => s.taskId === input.taskId && s.userId === input.userId);
    if (existing) {
      throw new DuplicateSubmissionError();
    }

    const social = Array.from(this.socialAccounts.values()).find((s) => s.id === socialAccountId);
    if (!social || social.userId !== input.userId || social.status !== "ACTIVE" || social.platform !== task.platform) {
      throw new IneligibleSocialAccountError();
    }

    const user = this.users.get(input.userId);
    const now = new Date().toISOString();

    // Automated Fraud & Security Evaluation
    const security = evaluateSubmissionSecurity(
      {
        taskId: task.id,
        taskPlatform: task.platform,
        userId: input.userId,
        proofUrl: input.proofUrl,
        workerHandle: social.handle,
      },
      {
        allRecentSubmissions: this.submissions.map((s) => ({
          id: s.id,
          userId: s.userId,
          taskId: s.taskId,
          proofUrl: s.proofUrl,
          createdAt: s.submittedAt,
        })),
        userRecentSubmissions: this.submissions
          .filter((s) => s.userId === input.userId)
          .map((s) => ({
            id: s.id,
            userId: s.userId,
            taskId: s.taskId,
            proofUrl: s.proofUrl,
            createdAt: s.submittedAt,
          })),
      },
    );

    const submissionId = `sub-${++this.seq}`;

    if (security.flagged && security.fraudType) {
      this.fraudEvents.push({
        id: `fraud-${++this.seq}`,
        userId: input.userId,
        userEmail: user?.email ?? "worker@example.com",
        userDisplayName: user?.displayName ?? "Worker",
        submissionId,
        type: security.fraudType,
        severity: security.severity,
        details: security.details ?? null,
        createdAt: now,
      });
    }

    const submission: StoredSubmission = {
      id: submissionId,
      taskId: task.id,
      taskTitle: task.title,
      taskPlatform: task.platform,
      rewardPoints: task.rewardPoints,
      rewardAmountMinor: task.rewardAmountMinor,
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      campaignOwnerId: campaign.ownerId,
      userId: input.userId,
      userDisplayName: user?.displayName ?? "Worker",
      userEmail: user?.email ?? "worker@example.com",
      socialAccountId,
      socialPlatform: social.platform,
      socialHandle: social.handle,
      status: security.flagged ? "FLAGGED" : "PENDING",
      proofUrl: input.proofUrl,
      reviewerNote: security.flagged ? `Security Flag: ${security.reasons.join("; ")}` : null,
      rejectionReason: null,
      appealReason: null,
      appealedAt: null,
      appealReviewNote: null,
      reviewedById: null,
      submittedAt: now,
      reviewedAt: null,
      createdAt: now,
    };

    this.submissions.push(submission);
    return submission;
  }

  async findSubmissionById(id: string): Promise<StoredSubmission | null> {
    return this.submissions.find((s) => s.id === id) ?? null;
  }

  async findSubmissionByUserAndTask(userId: string, taskId: string): Promise<StoredSubmission | null> {
    return this.submissions.find((s) => s.userId === userId && s.taskId === taskId) ?? null;
  }

  async listSubmissions(filters?: {
    userId?: string;
    campaignId?: string;
    ownerId?: string;
    status?: SubmissionStatus;
  }): Promise<StoredSubmission[]> {
    let result = [...this.submissions];
    if (filters?.userId) {
      result = result.filter((s) => s.userId === filters.userId);
    }
    if (filters?.campaignId) {
      result = result.filter((s) => s.campaignId === filters.campaignId);
    }
    if (filters?.ownerId) {
      result = result.filter((s) => s.campaignOwnerId === filters.ownerId);
    }
    if (filters?.status) {
      result = result.filter((s) => s.status === filters.status);
    }
    return result.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }

  async reviewSubmission(input: ReviewSubmissionInput): Promise<StoredSubmission> {
    const submission = this.submissions.find((s) => s.id === input.submissionId);
    if (!submission) {
      throw new InvalidStateError("Submission not found.");
    }
    if (submission.status !== "PENDING" && submission.status !== "APPEALED") {
      throw new InvalidStateError(`Submission is already ${submission.status}.`);
    }

    return this.withLock(submission.campaignId, async () => {
      const task = this.tasks.find((t) => t.id === submission.taskId);
      if (!task) {
        throw new InvalidStateError("Task not found.");
      }

      const now = new Date().toISOString();

      if (input.decision === "approve") {
        if (task.slotsFilled >= task.slotsTotal) {
          throw new SlotLimitError();
        }

        const budget = await this.getCampaignBudgetSummary(submission.campaignId);
        if (budget.availableBudgetMinor < task.rewardAmountMinor) {
          throw new InsufficientBudgetError();
        }

        // Check duplicate reward idempotency
        const duplicateReward = this.pointsEntries.find((p) => p.submissionId === submission.id);
        if (duplicateReward) {
          throw new InvalidStateError("A reward has already been issued for this submission.");
        }

        // Atomic transition
        submission.status = "APPROVED";
        submission.reviewedById = input.reviewerId;
        submission.reviewedAt = now;
        submission.reviewerNote = input.note ?? "Approved submission";

        task.slotsFilled += 1;

        // Debit campaign budget
        this.budgetEntries.push({
          id: `budget-${++this.seq}`,
          campaignId: submission.campaignId,
          amountMinor: -task.rewardAmountMinor,
          reason: "PAYOUT",
          submissionId: submission.id,
          note: `Payout for submission ${submission.id}`,
          createdAt: now,
        });

        // Credit worker OP balance in append-only points ledger
        this.pointsEntries.push({
          id: `pts-${++this.seq}`,
          userId: submission.userId,
          deltaPoints: task.rewardPoints,
          reason: "TASK_REWARD",
          campaignId: submission.campaignId,
          submissionId: submission.id,
          note: `Reward for task: ${task.title}`,
          createdAt: now,
        });
      } else {
        // Reject
        if (!input.rejectionReason || input.rejectionReason.trim().length < 5) {
          throw new InvalidStateError("A clear rejection reason of at least 5 characters is required.");
        }
        submission.status = "REJECTED";
        submission.reviewedById = input.reviewerId;
        submission.reviewedAt = now;
        submission.rejectionReason = input.rejectionReason.trim();
        submission.reviewerNote = input.note ?? input.rejectionReason.trim();
      }

      return submission;
    });
  }

  async appealSubmission(input: AppealSubmissionInput): Promise<StoredSubmission> {
    const submission = this.submissions.find((s) => s.id === input.submissionId);
    if (!submission) {
      throw new InvalidStateError("Submission not found.");
    }
    if (submission.userId !== input.userId) {
      throw new InvalidStateError("You can only appeal your own submissions.");
    }
    if (submission.status !== "REJECTED") {
      throw new InvalidStateError("Only rejected submissions can be appealed.");
    }
    if (!input.appealReason || input.appealReason.trim().length < 10) {
      throw new InvalidStateError("Please provide an appeal reason of at least 10 characters.");
    }

    submission.status = "APPEALED";
    submission.appealReason = input.appealReason.trim();
    submission.appealedAt = new Date().toISOString();
    return submission;
  }

  async decideAppeal(input: DecideAppealInput): Promise<StoredSubmission> {
    const submission = this.submissions.find((s) => s.id === input.submissionId);
    if (!submission) {
      throw new InvalidStateError("Submission not found.");
    }
    if (submission.status !== "APPEALED") {
      throw new InvalidStateError("Only appealed submissions can be decided.");
    }

    return this.withLock(submission.campaignId, async () => {
      const task = this.tasks.find((t) => t.id === submission.taskId);
      if (!task) {
        throw new InvalidStateError("Task not found.");
      }

      const now = new Date().toISOString();

      if (input.decision === "overturn") {
        // Approving appeal
        if (task.slotsFilled >= task.slotsTotal) {
          throw new SlotLimitError();
        }
        const budget = await this.getCampaignBudgetSummary(submission.campaignId);
        if (budget.availableBudgetMinor < task.rewardAmountMinor) {
          throw new InsufficientBudgetError();
        }

        submission.status = "APPROVED";
        submission.reviewedById = input.reviewerId;
        submission.reviewedAt = now;
        submission.appealReviewNote = input.note;

        task.slotsFilled += 1;

        // Debit budget
        this.budgetEntries.push({
          id: `budget-${++this.seq}`,
          campaignId: submission.campaignId,
          amountMinor: -task.rewardAmountMinor,
          reason: "PAYOUT",
          submissionId: submission.id,
          note: `Payout for overturned appeal ${submission.id}`,
          createdAt: now,
        });

        // Credit worker points
        this.pointsEntries.push({
          id: `pts-${++this.seq}`,
          userId: submission.userId,
          deltaPoints: task.rewardPoints,
          reason: "TASK_REWARD",
          campaignId: submission.campaignId,
          submissionId: submission.id,
          note: `Reward for overturned appeal on task: ${task.title}`,
          createdAt: now,
        });
      } else {
        // Upholding rejection
        submission.status = "REJECTED";
        submission.reviewedById = input.reviewerId;
        submission.reviewedAt = now;
        submission.appealReviewNote = input.note;
      }

      return submission;
    });
  }

  async getWorkerPointsSummary(userId: string): Promise<WorkerPointsSummary> {
    const entries = this.pointsEntries.filter((p) => p.userId === userId);
    let total = 0;
    let earned = 0;
    for (const e of entries) {
      total += e.deltaPoints;
      if (e.deltaPoints > 0) {
        earned += e.deltaPoints;
      }
    }
    return {
      userId,
      currentBalance: total,
      totalEarned: earned,
      totalEntries: entries.length,
    };
  }

  async listWorkerPointsHistory(userId: string): Promise<PointsHistoryEntry[]> {
    const entries = this.pointsEntries.filter((p) => p.userId === userId);
    return entries
      .map((e) => {
        const campaign = e.campaignId ? this.campaigns.find((c) => c.id === e.campaignId) : null;
        return {
          id: e.id,
          userId: e.userId,
          deltaPoints: e.deltaPoints,
          reason: e.reason,
          campaignId: e.campaignId ?? null,
          campaignTitle: campaign?.title ?? null,
          submissionId: e.submissionId ?? null,
          note: e.note ?? null,
          createdAt: e.createdAt,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getAdvertiserFundsSummary(userId: string): Promise<AdvertiserFundsSummary> {
    const payments = this.payments.filter((p) => p.userId === userId);
    let totalDeposited = 0;
    let pendingDeposits = 0;

    for (const p of payments) {
      if (p.status === "COMPLETED") {
        totalDeposited += p.amountMinor;
      } else if (p.status === "PENDING") {
        pendingDeposits += p.amountMinor;
      }
    }

    // Sum of all funds allocated to campaigns by this advertiser
    const campaigns = this.campaigns.filter((c) => c.ownerId === userId);
    let totalAllocated = 0;
    for (const c of campaigns) {
      const budget = await this.getCampaignBudgetSummary(c.id);
      totalAllocated += budget.totalFundedMinor;
    }

    return {
      userId,
      totalDepositedMinor: totalDeposited,
      totalAllocatedMinor: totalAllocated,
      pendingDepositsMinor: pendingDeposits,
      availableBalanceMinor: Math.max(0, totalDeposited - totalAllocated),
    };
  }

  async createDepositIntent(
    userId: string,
    amountMinor: number,
    externalReference?: string,
  ): Promise<{ paymentId: string; status: PaymentStatus }> {
    if (amountMinor <= 0) {
      throw new InvalidStateError("Deposit amount must be positive.");
    }
    const payment: PaymentRecord = {
      id: `pay-${++this.seq}`,
      userId,
      amountMinor,
      currency: "USD",
      status: "PENDING", // Never fake COMPLETED!
      externalReference,
      createdAt: new Date().toISOString(),
    };
    this.payments.push(payment);
    return { paymentId: payment.id, status: payment.status };
  }

  async listFraudEvents(filters?: { userId?: string; severity?: string }): Promise<StoredFraudEvent[]> {
    let result = [...this.fraudEvents];
    if (filters?.userId) result = result.filter((f) => f.userId === filters.userId);
    if (filters?.severity) result = result.filter((f) => f.severity === filters.severity);
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async resolveFraudEvent(
    eventId: string,
    action: "DISMISS" | "CONFIRM",
    adminId: string,
    note?: string,
  ): Promise<{ ok: boolean; message: string }> {
    const event = this.fraudEvents.find((f) => f.id === eventId);
    if (!event) {
      throw new InvalidStateError("Fraud event not found.");
    }

    if (event.resolvedAt) throw new InvalidStateError("This event is already resolved.");
    const target = this.submissions.find((sub) => sub.id === event.submissionId);
    if (target && target.status !== "FLAGGED") throw new InvalidStateError("Submission is no longer flagged.");
    event.resolvedAt = new Date().toISOString();
    event.resolution = action;

    if (event.submissionId) {
      const submission = this.submissions.find((s) => s.id === event.submissionId);
      if (submission) {
        if (action === "DISMISS") {
          if (submission.status === "FLAGGED") {
            submission.status = "PENDING";
            submission.reviewerNote = note ? `Unflagged by admin: ${note}` : "Unflagged by admin.";
          }
        } else {
          submission.status = "REJECTED";
          submission.rejectionReason = note ?? "Submission rejected due to verified fraud policy violation.";
          submission.reviewedById = adminId;
          submission.reviewedAt = new Date().toISOString();
        }
      }
    }

    return { ok: true, message: `Fraud event ${action.toLowerCase()}ed successfully.` };
  }
}
