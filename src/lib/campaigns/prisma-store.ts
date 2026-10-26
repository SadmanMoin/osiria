import { getPrisma } from "@/lib/db/prisma";
import { evaluateSubmissionSecurity, normalizeProofUrl } from "@/lib/security/fraud";
import type { StoredFraudEvent } from "@/lib/security/types";
import {
  DuplicateSubmissionError,
  IneligibleSocialAccountError,
  InsufficientBudgetError,
  InvalidStateError,
  SlotLimitError,
  type CampaignStore,
} from "@/lib/campaigns/store";
import type {
  AdvertiserFundsSummary,
  AppealSubmissionInput,
  CampaignBudgetSummary,
  CampaignPlatform,
  CampaignStatus,
  CampaignTaskStatus,
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

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

function toIso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

export class PrismaCampaignStore implements CampaignStore {
  async createCampaign(input: CreateCampaignInput): Promise<StoredCampaign> {
    const prisma = getPrisma();
    try {
      const campaign = await prisma.$transaction(async (tx) => {
        const created = await tx.campaign.create({
          data: {
            ownerId: input.ownerId,
            title: input.title,
            slug: input.slug,
            description: input.description,
            budgetMinor: input.budgetMinor,
            currency: input.currency ?? "USD",
            startsAt: input.startsAt ? new Date(input.startsAt) : null,
            endsAt: input.endsAt ? new Date(input.endsAt) : null,
            status: "DRAFT",
            tasks: {
              create: input.tasks.map((t) => ({
                platform: t.platform,
                title: t.title,
                instructions: t.instructions,
                rewardPoints: t.rewardPoints,
                rewardAmountMinor: t.rewardAmountMinor,
                slotsTotal: t.slotsTotal,
                status: "DRAFT",
              })),
            },
          },
          include: {
            owner: { select: { displayName: true } },
            tasks: true,
          },
        });
        await tx.adminAuditLog.create({ data: { actorUserId: input.ownerId, action: "campaign.create", entityType: "Campaign", entityId: created.id, metadata: { budgetMinor: input.budgetMinor } } });
        return created;
      });

      return {
        id: campaign.id,
        ownerId: campaign.ownerId,
        ownerName: campaign.owner.displayName,
        slug: campaign.slug,
        title: campaign.title,
        description: campaign.description,
        status: campaign.status as CampaignStatus,
        budgetMinor: campaign.budgetMinor,
        currency: campaign.currency,
        startsAt: toIso(campaign.startsAt),
        endsAt: toIso(campaign.endsAt),
        createdAt: campaign.createdAt.toISOString(),
        updatedAt: campaign.updatedAt.toISOString(),
        tasks: campaign.tasks.map((t) => ({
          id: t.id,
          campaignId: t.campaignId,
          platform: t.platform as CampaignPlatform,
          title: t.title,
          instructions: t.instructions,
          rewardPoints: t.rewardPoints,
          rewardAmountMinor: t.rewardAmountMinor,
          slotsTotal: t.slotsTotal,
          slotsFilled: t.slotsFilled,
          status: t.status as CampaignTaskStatus,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
        budgetSummary: {
          campaignId: campaign.id,
          budgetCapMinor: campaign.budgetMinor,
          totalFundedMinor: 0,
          totalPaidMinor: 0,
          totalReservedMinor: 0,
          availableBudgetMinor: 0,
        },
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new InvalidStateError("Campaign slug is already taken.");
      }
      throw error;
    }
  }

  async findCampaignById(id: string): Promise<StoredCampaign | null> {
    const prisma = getPrisma();
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        owner: { select: { displayName: true } },
        tasks: true,
      },
    });
    if (!campaign) return null;
    const budgetSummary = await this.getCampaignBudgetSummary(id);

    return {
      id: campaign.id,
      ownerId: campaign.ownerId,
      ownerName: campaign.owner.displayName,
      slug: campaign.slug,
      title: campaign.title,
      description: campaign.description,
      status: campaign.status as CampaignStatus,
      budgetMinor: campaign.budgetMinor,
      currency: campaign.currency,
      startsAt: toIso(campaign.startsAt),
      endsAt: toIso(campaign.endsAt),
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      tasks: campaign.tasks.map((t) => ({
        id: t.id,
        campaignId: t.campaignId,
        platform: t.platform as CampaignPlatform,
        title: t.title,
        instructions: t.instructions,
        rewardPoints: t.rewardPoints,
        rewardAmountMinor: t.rewardAmountMinor,
        slotsTotal: t.slotsTotal,
        slotsFilled: t.slotsFilled,
        status: t.status as CampaignTaskStatus,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      budgetSummary,
    };
  }

  async findCampaignBySlug(slug: string): Promise<StoredCampaign | null> {
    const prisma = getPrisma();
    const campaign = await prisma.campaign.findUnique({
      where: { slug },
      include: {
        owner: { select: { displayName: true } },
        tasks: true,
      },
    });
    if (!campaign) return null;
    const budgetSummary = await this.getCampaignBudgetSummary(campaign.id);

    return {
      id: campaign.id,
      ownerId: campaign.ownerId,
      ownerName: campaign.owner.displayName,
      slug: campaign.slug,
      title: campaign.title,
      description: campaign.description,
      status: campaign.status as CampaignStatus,
      budgetMinor: campaign.budgetMinor,
      currency: campaign.currency,
      startsAt: toIso(campaign.startsAt),
      endsAt: toIso(campaign.endsAt),
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      tasks: campaign.tasks.map((t) => ({
        id: t.id,
        campaignId: t.campaignId,
        platform: t.platform as CampaignPlatform,
        title: t.title,
        instructions: t.instructions,
        rewardPoints: t.rewardPoints,
        rewardAmountMinor: t.rewardAmountMinor,
        slotsTotal: t.slotsTotal,
        slotsFilled: t.slotsFilled,
        status: t.status as CampaignTaskStatus,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      budgetSummary,
    };
  }

  async listCampaigns(filters?: { status?: CampaignStatus; ownerId?: string }): Promise<StoredCampaign[]> {
    const prisma = getPrisma();
    const rows = await prisma.campaign.findMany({
      where: {
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.ownerId ? { ownerId: filters.ownerId } : {}),
      },
      include: {
        owner: { select: { displayName: true } },
        tasks: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return Promise.all(
      rows.map(async (c) => {
        const budgetSummary = await this.getCampaignBudgetSummary(c.id);
        return {
          id: c.id,
          ownerId: c.ownerId,
          ownerName: c.owner.displayName,
          slug: c.slug,
          title: c.title,
          description: c.description,
          status: c.status as CampaignStatus,
          budgetMinor: c.budgetMinor,
          currency: c.currency,
          startsAt: toIso(c.startsAt),
          endsAt: toIso(c.endsAt),
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          tasks: c.tasks.map((t) => ({
            id: t.id,
            campaignId: t.campaignId,
            platform: t.platform as CampaignPlatform,
            title: t.title,
            instructions: t.instructions,
            rewardPoints: t.rewardPoints,
            rewardAmountMinor: t.rewardAmountMinor,
            slotsTotal: t.slotsTotal,
            slotsFilled: t.slotsFilled,
            status: t.status as CampaignTaskStatus,
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.updatedAt.toISOString(),
          })),
          budgetSummary,
        };
      }),
    );
  }

  async moderateCampaign(input: ModerateCampaignInput): Promise<StoredCampaign | null> {
    const prisma = getPrisma();
    let nextStatus: CampaignStatus = "OPEN";
    let nextTaskStatus: CampaignTaskStatus = "ACTIVE";

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

    await prisma.$transaction(async (tx) => {
      const current = await tx.campaign.findUnique({ where: { id: input.campaignId } });
      if (!current) throw new InvalidStateError("Campaign not found.");
      const allowed = input.action === "approve" ? current.status === "DRAFT" : input.action === "resume" ? current.status === "PAUSED" : input.action === "pause" ? current.status === "OPEN" : current.status !== "CLOSED";
      if (!allowed) throw new InvalidStateError("Invalid campaign status transition.");
      await tx.campaign.update({
        where: { id: input.campaignId },
        data: { status: nextStatus },
      });
      await tx.campaignTask.updateMany({
        where: { campaignId: input.campaignId },
        data: { status: nextTaskStatus },
      });
      await tx.adminAuditLog.create({
        data: {
          actorUserId: input.moderatorId,
          action: `campaign.${input.action}`,
          entityType: "Campaign",
          entityId: input.campaignId,
          metadata: { note: input.note, nextStatus },
        },
      });
    }, { isolationLevel: "Serializable" });

    return this.findCampaignById(input.campaignId);
  }

  async findTaskById(id: string): Promise<StoredCampaignTask | null> {
    const row = await getPrisma().campaignTask.findUnique({ where: { id } });
    if (!row) return null;
    return {
      id: row.id,
      campaignId: row.campaignId,
      platform: row.platform as CampaignPlatform,
      title: row.title,
      instructions: row.instructions,
      rewardPoints: row.rewardPoints,
      rewardAmountMinor: row.rewardAmountMinor,
      slotsTotal: row.slotsTotal,
      slotsFilled: row.slotsFilled,
      status: row.status as CampaignTaskStatus,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getCampaignBudgetSummary(campaignId: string): Promise<CampaignBudgetSummary> {
    const prisma = getPrisma();
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { budgetMinor: true },
    });
    const entries = await prisma.campaignBudgetLedger.findMany({
      where: { campaignId },
      select: { amountMinor: true, reason: true },
    });

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
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 1 || input.amountMinor > 2_147_483_647 || !input.paymentId) {
      throw new InvalidStateError("A verified settled payment and valid amount are required.");
    }
    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.findUnique({ where: { id: input.campaignId } });
      const payment = await tx.payment.findUnique({ where: { id: input.paymentId } });
      if (!campaign || !payment || payment.status !== "COMPLETED" || payment.userId !== campaign.ownerId || payment.currency !== campaign.currency) {
        throw new InvalidStateError("Payment must be settled and belong to the campaign owner in the same currency.");
      }
      const allocated = await tx.campaignBudgetLedger.aggregate({ where: { paymentId: payment.id, reason: "FUND" }, _sum: { amountMinor: true } });
      const funded = await tx.campaignBudgetLedger.aggregate({ where: { campaignId: campaign.id, reason: "FUND" }, _sum: { amountMinor: true } });
      if ((allocated._sum.amountMinor ?? 0) + input.amountMinor > payment.amountMinor || (funded._sum.amountMinor ?? 0) + input.amountMinor > campaign.budgetMinor) {
        throw new InsufficientBudgetError();
      }
      await tx.campaignBudgetLedger.create({ data: { campaignId: campaign.id, amountMinor: input.amountMinor, reason: "FUND", paymentId: payment.id, note: input.note } });
      await tx.adminAuditLog.create({ data: { actorUserId: campaign.ownerId, action: "campaign.fund", entityType: "Campaign", entityId: campaign.id, metadata: { amountMinor: input.amountMinor, paymentId: payment.id } } });
    }, { isolationLevel: "Serializable" });
    return this.getCampaignBudgetSummary(input.campaignId);
  }

  async createSubmission(input: CreateSubmissionInput, socialAccountId: string): Promise<StoredSubmission> {
    const prisma = getPrisma();
    try {
      const row = await prisma.$transaction(async (tx) => {
        const task = await tx.campaignTask.findUnique({
          where: { id: input.taskId },
          include: { campaign: true },
        });
        if (!task) {
          throw new InvalidStateError("Task not found.");
        }
        if (task.campaign.status !== "OPEN" || task.status !== "ACTIVE") {
          throw new InvalidStateError("This task is not open for submissions.");
        }
        const now = new Date();
        if ((task.campaign.startsAt && task.campaign.startsAt > now) || (task.campaign.endsAt && task.campaign.endsAt <= now)) {
          throw new InvalidStateError("Campaign is outside its submission period.");
        }
        if (task.slotsFilled >= task.slotsTotal) {
          throw new SlotLimitError();
        }

        const social = await tx.socialAccount.findUnique({
          where: { id: socialAccountId },
        });
        if (!social || social.userId !== input.userId || social.platform !== task.platform || social.status !== "ACTIVE") {
          throw new IneligibleSocialAccountError();
        }

        // Security & Fraud Heuristics
        const recentSubs = await tx.taskSubmission.findMany({
          where: {
            OR: [
              { userId: input.userId, createdAt: { gte: new Date(Date.now() - 60_000) } },
              { normalizedProofUrl: normalizeProofUrl(input.proofUrl) },
              // Legacy rows remain checked until the operator runs the backfill.
              { normalizedProofUrl: null },
            ],
          },
          select: { id: true, userId: true, taskId: true, proofUrl: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        });

        const security = evaluateSubmissionSecurity(
          {
            taskId: task.id,
            taskPlatform: task.platform as CampaignPlatform,
            userId: input.userId,
            proofUrl: input.proofUrl,
            workerHandle: social.handle,
          },
          {
            allRecentSubmissions: recentSubs.map((s) => ({
              id: s.id,
              userId: s.userId,
              taskId: s.taskId,
              proofUrl: s.proofUrl ?? "",
              createdAt: s.createdAt.toISOString(),
            })),
            userRecentSubmissions: recentSubs
              .filter((s) => s.userId === input.userId)
              .map((s) => ({
                id: s.id,
                userId: s.userId,
                taskId: s.taskId,
                proofUrl: s.proofUrl ?? "",
                createdAt: s.createdAt.toISOString(),
              })),
          },
        );

        const sub = await tx.taskSubmission.create({
          data: {
            taskId: input.taskId,
            userId: input.userId,
            socialAccountId,
            status: security.flagged ? "FLAGGED" : "PENDING",
            proofUrl: input.proofUrl,
            normalizedProofUrl: normalizeProofUrl(input.proofUrl),
            reviewerNote: security.flagged ? `Security Flag: ${security.reasons.join("; ")}` : null,
          },
          include: {
            task: { include: { campaign: true } },
            user: { select: { displayName: true, email: true } },
            socialAccount: { select: { platform: true, handle: true } },
          },
        });

        if (security.flagged && security.fraudType) {
          await tx.fraudEvent.create({
            data: {
              userId: input.userId,
              submissionId: sub.id,
              type: security.fraudType as any, // eslint-disable-line @typescript-eslint/no-explicit-any
              severity: security.severity as any, // eslint-disable-line @typescript-eslint/no-explicit-any
              details: (security.details ?? {}) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            },
          });
        }

        await tx.adminAuditLog.create({ data: { actorUserId: input.userId, action: "submission.create", entityType: "TaskSubmission", entityId: sub.id, metadata: { status: sub.status, flagged: security.flagged } } });
        return sub;
      }, { isolationLevel: "Serializable" });

      return {
        id: row.id,
        taskId: row.taskId,
        taskTitle: row.task.title,
        taskPlatform: row.task.platform as CampaignPlatform,
        rewardPoints: row.task.rewardPoints,
        rewardAmountMinor: row.task.rewardAmountMinor,
        campaignId: row.task.campaignId,
        campaignTitle: row.task.campaign.title,
        campaignOwnerId: row.task.campaign.ownerId,
        userId: row.userId,
        userDisplayName: row.user.displayName,
        userEmail: row.user.email,
        socialAccountId: row.socialAccountId,
        socialPlatform: row.socialAccount.platform as CampaignPlatform,
        socialHandle: row.socialAccount.handle,
        status: row.status as SubmissionStatus,
        proofUrl: row.proofUrl ?? "",
        reviewerNote: row.reviewerNote,
        rejectionReason: row.rejectionReason,
        appealReason: row.appealReason,
        appealedAt: toIso(row.appealedAt),
        appealReviewNote: row.appealReviewNote,
        reviewedById: row.reviewedById,
        submittedAt: row.submittedAt.toISOString(),
        reviewedAt: toIso(row.reviewedAt),
        createdAt: row.createdAt.toISOString(),
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateSubmissionError();
      }
      throw error;
    }
  }

  async findSubmissionById(id: string): Promise<StoredSubmission | null> {
    const row = await getPrisma().taskSubmission.findUnique({
      where: { id },
      include: {
        task: { include: { campaign: true } },
        user: { select: { displayName: true, email: true } },
        socialAccount: { select: { platform: true, handle: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      taskId: row.taskId,
      taskTitle: row.task.title,
      taskPlatform: row.task.platform as CampaignPlatform,
      rewardPoints: row.task.rewardPoints,
      rewardAmountMinor: row.task.rewardAmountMinor,
      campaignId: row.task.campaignId,
      campaignTitle: row.task.campaign.title,
      campaignOwnerId: row.task.campaign.ownerId,
      userId: row.userId,
      userDisplayName: row.user.displayName,
      userEmail: row.user.email,
      socialAccountId: row.socialAccountId,
      socialPlatform: row.socialAccount.platform as CampaignPlatform,
      socialHandle: row.socialAccount.handle,
      status: row.status as SubmissionStatus,
      proofUrl: row.proofUrl ?? "",
      reviewerNote: row.reviewerNote,
      rejectionReason: row.rejectionReason,
      appealReason: row.appealReason,
      appealedAt: toIso(row.appealedAt),
      appealReviewNote: row.appealReviewNote,
      reviewedById: row.reviewedById,
      submittedAt: row.submittedAt.toISOString(),
      reviewedAt: toIso(row.reviewedAt),
      createdAt: row.createdAt.toISOString(),
    };
  }

  async findSubmissionByUserAndTask(userId: string, taskId: string): Promise<StoredSubmission | null> {
    const row = await getPrisma().taskSubmission.findUnique({
      where: { taskId_userId: { taskId, userId } },
      include: {
        task: { include: { campaign: true } },
        user: { select: { displayName: true, email: true } },
        socialAccount: { select: { platform: true, handle: true } },
      },
    });
    if (!row) return null;
    return this.findSubmissionById(row.id);
  }

  async listSubmissions(filters?: {
    userId?: string;
    campaignId?: string;
    ownerId?: string;
    status?: SubmissionStatus;
  }): Promise<StoredSubmission[]> {
    const prisma = getPrisma();
    const rows = await prisma.taskSubmission.findMany({
      where: {
        ...(filters?.userId ? { userId: filters.userId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.campaignId ? { task: { campaignId: filters.campaignId } } : {}),
        ...(filters?.ownerId ? { task: { campaign: { ownerId: filters.ownerId } } } : {}),
      },
      include: {
        task: { include: { campaign: true } },
        user: { select: { displayName: true, email: true } },
        socialAccount: { select: { platform: true, handle: true } },
      },
      orderBy: { submittedAt: "desc" },
    });

    return rows.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      taskTitle: row.task.title,
      taskPlatform: row.task.platform as CampaignPlatform,
      rewardPoints: row.task.rewardPoints,
      rewardAmountMinor: row.task.rewardAmountMinor,
      campaignId: row.task.campaignId,
      campaignTitle: row.task.campaign.title,
      campaignOwnerId: row.task.campaign.ownerId,
      userId: row.userId,
      userDisplayName: row.user.displayName,
      userEmail: row.user.email,
      socialAccountId: row.socialAccountId,
      socialPlatform: row.socialAccount.platform as CampaignPlatform,
      socialHandle: row.socialAccount.handle,
      status: row.status as SubmissionStatus,
      proofUrl: row.proofUrl ?? "",
      reviewerNote: row.reviewerNote,
      rejectionReason: row.rejectionReason,
      appealReason: row.appealReason,
      appealedAt: toIso(row.appealedAt),
      appealReviewNote: row.appealReviewNote,
      reviewedById: row.reviewedById,
      submittedAt: row.submittedAt.toISOString(),
      reviewedAt: toIso(row.reviewedAt),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async reviewSubmission(input: ReviewSubmissionInput): Promise<StoredSubmission> {
    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      const sub = await tx.taskSubmission.findUnique({
        where: { id: input.submissionId },
        include: { task: { include: { campaign: true } } },
      });
      if (!sub) throw new InvalidStateError("Submission not found.");
      if (sub.status !== "PENDING") {
        throw new InvalidStateError(`Submission is already ${sub.status}.`);
      }

      if (input.decision === "approve") {
        if (sub.task.slotsFilled >= sub.task.slotsTotal) {
          throw new SlotLimitError();
        }

        const budgetSum = await tx.campaignBudgetLedger.aggregate({
          where: { campaignId: sub.task.campaignId },
          _sum: { amountMinor: true },
        });
        const available = budgetSum._sum.amountMinor ?? 0;
        if (available < sub.task.rewardAmountMinor) {
          throw new InsufficientBudgetError();
        }

        await tx.taskSubmission.update({
          where: { id: sub.id },
          data: {
            status: "APPROVED",
            reviewedById: input.reviewerId,
            reviewedAt: new Date(),
            reviewerNote: input.note ?? "Approved submission",
          },
        });

        await tx.campaignTask.update({
          where: { id: sub.taskId },
          data: { slotsFilled: { increment: 1 } },
        });

        await tx.campaignBudgetLedger.create({
          data: {
            campaignId: sub.task.campaignId,
            amountMinor: -sub.task.rewardAmountMinor,
            reason: "PAYOUT",
            submissionId: sub.id,
            note: `Payout for submission ${sub.id}`,
          },
        });

        await tx.pointsLedger.create({
          data: {
            userId: sub.userId,
            deltaPoints: sub.task.rewardPoints,
            reason: "TASK_REWARD",
            campaignId: sub.task.campaignId,
            submissionId: sub.id,
            note: `Reward for task: ${sub.task.title}`,
          },
        });
      } else {
        if (!input.rejectionReason || input.rejectionReason.trim().length < 5) {
          throw new InvalidStateError("A clear rejection reason of at least 5 characters is required.");
        }
        await tx.taskSubmission.update({
          where: { id: sub.id },
          data: {
            status: "REJECTED",
            reviewedById: input.reviewerId,
            reviewedAt: new Date(),
            rejectionReason: input.rejectionReason.trim(),
            reviewerNote: input.note ?? input.rejectionReason.trim(),
          },
        });
      }
      await tx.adminAuditLog.create({ data: {
        actorUserId: input.reviewerId, action: "submission.reviewSubmission", entityType: "TaskSubmission", entityId: sub.id,
        metadata: { before: sub.status, decision: input.decision, note: input.note ?? null },
      } });
    }, { isolationLevel: "Serializable" });

    const updated = await this.findSubmissionById(input.submissionId);
    if (!updated) throw new InvalidStateError("Failed to load updated submission.");
    return updated;
  }

  async appealSubmission(input: AppealSubmissionInput): Promise<StoredSubmission> {
    const prisma = getPrisma();
    const sub = await prisma.taskSubmission.findUnique({ where: { id: input.submissionId } });
    if (!sub) throw new InvalidStateError("Submission not found.");
    if (sub.userId !== input.userId) throw new InvalidStateError("You can only appeal your own submissions.");
    if (sub.status !== "REJECTED") throw new InvalidStateError("Only rejected submissions can be appealed.");
    if (!input.appealReason || input.appealReason.trim().length < 10) {
      throw new InvalidStateError("Please provide an appeal reason of at least 10 characters.");
    }

    await prisma.$transaction(async (tx) => {
      const changed = await tx.taskSubmission.updateMany({
        where: { id: input.submissionId, userId: input.userId, status: "REJECTED" },
        data: {
          status: "APPEALED",
          appealReason: input.appealReason.trim(),
          appealedAt: new Date(),
        },
      });

      if (changed.count !== 1) throw new InvalidStateError("Submission changed. Reload before appealing.");
      await tx.adminAuditLog.create({ data: { actorUserId: input.userId, action: "submission.appeal", entityType: "TaskSubmission", entityId: input.submissionId, metadata: { reason: input.appealReason } } });
    }, { isolationLevel: "Serializable" });
    const updated = await this.findSubmissionById(input.submissionId);
    if (!updated) throw new InvalidStateError("Failed to load updated submission.");
    return updated;
  }

  async decideAppeal(input: DecideAppealInput): Promise<StoredSubmission> {
    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      const sub = await tx.taskSubmission.findUnique({
        where: { id: input.submissionId },
        include: { task: true },
      });
      if (!sub) throw new InvalidStateError("Submission not found.");
      if (sub.status !== "APPEALED") throw new InvalidStateError("Only appealed submissions can be decided.");

      if (input.decision === "overturn") {
        if (sub.task.slotsFilled >= sub.task.slotsTotal) {
          throw new SlotLimitError();
        }
        const budgetSum = await tx.campaignBudgetLedger.aggregate({
          where: { campaignId: sub.task.campaignId },
          _sum: { amountMinor: true },
        });
        const available = budgetSum._sum.amountMinor ?? 0;
        if (available < sub.task.rewardAmountMinor) {
          throw new InsufficientBudgetError();
        }

        await tx.taskSubmission.update({
          where: { id: sub.id },
          data: {
            status: "APPROVED",
            reviewedById: input.reviewerId,
            reviewedAt: new Date(),
            appealReviewNote: input.note,
          },
        });

        await tx.campaignTask.update({
          where: { id: sub.taskId },
          data: { slotsFilled: { increment: 1 } },
        });

        await tx.campaignBudgetLedger.create({
          data: {
            campaignId: sub.task.campaignId,
            amountMinor: -sub.task.rewardAmountMinor,
            reason: "PAYOUT",
            submissionId: sub.id,
            note: `Payout for overturned appeal ${sub.id}`,
          },
        });

        await tx.pointsLedger.create({
          data: {
            userId: sub.userId,
            deltaPoints: sub.task.rewardPoints,
            reason: "TASK_REWARD",
            campaignId: sub.task.campaignId,
            submissionId: sub.id,
            note: `Reward for overturned appeal on task: ${sub.task.title}`,
          },
        });
      } else {
        await tx.taskSubmission.update({
          where: { id: sub.id },
          data: {
            status: "REJECTED",
            reviewedById: input.reviewerId,
            reviewedAt: new Date(),
            appealReviewNote: input.note,
          },
        });
      }
      await tx.adminAuditLog.create({ data: {
        actorUserId: input.reviewerId, action: "submission.decideAppeal", entityType: "TaskSubmission", entityId: sub.id,
        metadata: { before: sub.status, decision: input.decision, note: input.note ?? null },
      } });
    }, { isolationLevel: "Serializable" });

    const updated = await this.findSubmissionById(input.submissionId);
    if (!updated) throw new InvalidStateError("Failed to load updated submission.");
    return updated;
  }

  async getWorkerPointsSummary(userId: string): Promise<WorkerPointsSummary> {
    const prisma = getPrisma();
    const rows = await prisma.pointsLedger.findMany({
      where: { userId },
      select: { deltaPoints: true },
    });
    let currentBalance = 0;
    let totalEarned = 0;
    for (const r of rows) {
      currentBalance += r.deltaPoints;
      if (r.deltaPoints > 0) {
        totalEarned += r.deltaPoints;
      }
    }
    return {
      userId,
      currentBalance,
      totalEarned,
      totalEntries: rows.length,
    };
  }

  async listWorkerPointsHistory(userId: string): Promise<PointsHistoryEntry[]> {
    const prisma = getPrisma();
    const rows = await prisma.pointsLedger.findMany({
      where: { userId },
      include: { campaign: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      deltaPoints: r.deltaPoints,
      reason: r.reason,
      campaignId: r.campaignId,
      campaignTitle: r.campaign?.title ?? null,
      submissionId: r.submissionId,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async getAdvertiserFundsSummary(userId: string): Promise<AdvertiserFundsSummary> {
    const prisma = getPrisma();
    const payments = await prisma.payment.findMany({
      where: { userId },
      select: { amountMinor: true, status: true },
    });

    let totalDeposited = 0;
    let pendingDeposits = 0;

    for (const p of payments) {
      if (p.status === "COMPLETED") {
        totalDeposited += p.amountMinor;
      } else if (p.status === "PENDING") {
        pendingDeposits += p.amountMinor;
      }
    }

    const campaigns = await prisma.campaign.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });

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
    const prisma = getPrisma();
    const payment = await prisma.payment.create({
      data: {
        userId,
        amountMinor,
        currency: "USD",
        status: "PENDING", // Never fake success!
        externalReference,
      },
    });
    return { paymentId: payment.id, status: payment.status as PaymentStatus };
  }

  async listFraudEvents(filters?: { userId?: string; severity?: string }): Promise<StoredFraudEvent[]> {
    const prisma = getPrisma();
    const where: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.severity) where.severity = filters.severity as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const rows = await prisma.fraudEvent.findMany({
      where,
      take: 200,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { email: true, displayName: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userEmail: r.user?.email ?? null,
      userDisplayName: r.user?.displayName ?? null,
      submissionId: r.submissionId,
      resolvedAt: toIso(r.resolvedAt),
      resolution: r.resolution,
      type: r.type,
      severity: r.severity,
      details: (r.details as Record<string, unknown>) ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async resolveFraudEvent(
    eventId: string,
    action: "DISMISS" | "CONFIRM",
    adminId: string,
    note?: string,
  ): Promise<{ ok: boolean; message: string }> {
    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      const event = await tx.fraudEvent.findUnique({
        where: { id: eventId },
        include: { submission: true },
      });
      if (!event) throw new InvalidStateError("Fraud event not found.");
      if (event.resolvedAt || (event.submission && event.submission.status !== "FLAGGED")) {
        throw new InvalidStateError("This event is already resolved or its submission is no longer flagged.");
      }
      await tx.fraudEvent.update({ where: { id: event.id }, data: { resolvedAt: new Date(), resolution: action, resolvedById: adminId } });

      if (event.submissionId && event.submission) {
        if (action === "DISMISS") {
          if (event.submission.status === "FLAGGED") {
            await tx.taskSubmission.update({
              where: { id: event.submissionId },
              data: {
                status: "PENDING",
                reviewerNote: note ? `Unflagged by admin: ${note}` : "Unflagged by admin.",
              },
            });
          }
        } else {
          await tx.taskSubmission.update({
            where: { id: event.submissionId },
            data: {
              status: "REJECTED",
              rejectionReason: note ?? "Submission rejected due to verified fraud policy violation.",
              reviewedById: adminId,
              reviewedAt: new Date(),
            },
          });
        }
      }

      await tx.adminAuditLog.create({
        data: {
          actorUserId: adminId,
          action: `fraud.${action.toLowerCase()}`,
          entityType: "FraudEvent",
          entityId: event.id,
          metadata: { note, submissionId: event.submissionId, action },
        },
      });
    }, { isolationLevel: "Serializable" });

    return { ok: true, message: `Fraud event ${action.toLowerCase()}ed successfully.` };
  }
}

export function getCampaignStore(): CampaignStore {
  return new PrismaCampaignStore();
}
