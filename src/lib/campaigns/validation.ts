import type {
  AppealSubmissionInput,
  CampaignPlatform,
  CreateCampaignInput,
  CreateSubmissionInput,
  DecideAppealInput,
  FundCampaignInput,
  ModerateCampaignInput,
  ReviewSubmissionInput,
} from "@/lib/campaigns/types";

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors: Record<string, string> };

const VALID_PLATFORMS: CampaignPlatform[] = [
  "X",
  "FACEBOOK",
  "INSTAGRAM",
  "TIKTOK",
  "YOUTUBE",
  "THREADS",
  "LINKEDIN",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return value.length <= 2048 && !url.username && !url.password && !url.port && (url.protocol === "http:" || url.protocol === "https:");
  } catch {
    return false;
  }
}

export function parseCreateCampaign(
  input: unknown,
  ownerId: string,
): ValidationResult<CreateCampaignInput> {
  if (!isRecord(input)) {
    return { ok: false, message: "Campaign data must be an object.", fieldErrors: {} };
  }

  const fieldErrors: Record<string, string> = {};
  for (const key of ["note", "rejectionReason"]) {
    if (input[key] !== undefined && (typeof input[key] !== "string" || input[key].length > 1000)) {
      fieldErrors[key] = "Text must be at most 1000 characters.";
    }
  }

  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (title.length < 3 || title.length > 100) {
    fieldErrors.title = "Title must be between 3 and 100 characters.";
  }

  const rawSlug = typeof input.slug === "string" ? input.slug.trim().toLowerCase() : "";
  const slug = rawSlug.replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (slug.length < 3 || slug.length > 60) {
    fieldErrors.slug = "Slug must be between 3 and 60 lowercase alphanumeric characters and hyphens.";
  }

  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (description.length < 10 || description.length > 2000) {
    fieldErrors.description = "Description must be between 10 and 2000 characters.";
  }

  const budgetMinor =
    typeof input.budgetMinor === "number"
      ? input.budgetMinor
      : typeof input.budgetMinor === "string" && /^\d+$/.test(input.budgetMinor.trim())
        ? Number(input.budgetMinor.trim())
        : null;

  if (budgetMinor === null || !Number.isSafeInteger(budgetMinor) || budgetMinor < 100 || budgetMinor > 2_147_483_647) {
    fieldErrors.budgetMinor = "Budget must be at least $1.00 (100 cents).";
  }

  const tasksList = Array.isArray(input.tasks) ? input.tasks : [];
  if (tasksList.length === 0 || tasksList.length > 50) {
    fieldErrors.tasks = "At least one campaign task is required.";
  }

  const parsedTasks: CreateCampaignInput["tasks"] = [];
  let totalTasksBudgetMinor = 0;

  tasksList.forEach((t, idx) => {
    if (!isRecord(t)) {
      fieldErrors[`tasks[${idx}]`] = "Invalid task data.";
      return;
    }
    const platform = String(t.platform ?? "").toUpperCase() as CampaignPlatform;
    if (!VALID_PLATFORMS.includes(platform)) {
      fieldErrors[`tasks[${idx}].platform`] = "Choose a valid social platform.";
    }

    const tTitle = typeof t.title === "string" ? t.title.trim() : "";
    if (tTitle.length < 3 || tTitle.length > 100) {
      fieldErrors[`tasks[${idx}].title`] = "Task title must be between 3 and 100 characters.";
    }

    const tInstructions = typeof t.instructions === "string" ? t.instructions.trim() : "";
    if (tInstructions.length < 10 || tInstructions.length > 1000) {
      fieldErrors[`tasks[${idx}].instructions`] = "Instructions must be between 10 and 1000 characters.";
    }

    const rewardPoints = typeof t.rewardPoints === "number" || (typeof t.rewardPoints === "string" && /^\d+$/.test(t.rewardPoints)) ? Number(t.rewardPoints) : NaN;
    if (!Number.isSafeInteger(rewardPoints) || rewardPoints < 1 || rewardPoints > 2_147_483_647) {
      fieldErrors[`tasks[${idx}].rewardPoints`] = "Reward points must be at least 1 OP.";
    }

    const rewardAmountMinor = typeof t.rewardAmountMinor === "number" || (typeof t.rewardAmountMinor === "string" && /^\d+$/.test(t.rewardAmountMinor)) ? Number(t.rewardAmountMinor) : NaN;
    if (!Number.isSafeInteger(rewardAmountMinor) || rewardAmountMinor < 1 || rewardAmountMinor > 2_147_483_647) {
      fieldErrors[`tasks[${idx}].rewardAmountMinor`] = "Reward payout must be at least 1 cent.";
    }

    const slotsTotal = typeof t.slotsTotal === "number" || (typeof t.slotsTotal === "string" && /^\d+$/.test(t.slotsTotal)) ? Number(t.slotsTotal) : NaN;
    if (!Number.isSafeInteger(slotsTotal) || slotsTotal < 1 || slotsTotal > 2_147_483_647) {
      fieldErrors[`tasks[${idx}].slotsTotal`] = "Total slots must be at least 1.";
    }

    if (
      VALID_PLATFORMS.includes(platform) &&
      tTitle &&
      tInstructions &&
      rewardPoints >= 1 &&
      rewardAmountMinor >= 1 &&
      slotsTotal >= 1
    ) {
      totalTasksBudgetMinor += rewardAmountMinor * slotsTotal;
      parsedTasks.push({
        platform,
        title: tTitle,
        instructions: tInstructions,
        rewardPoints,
        rewardAmountMinor,
        slotsTotal,
      });
    }
  });

  if (budgetMinor !== null && totalTasksBudgetMinor > budgetMinor) {
    fieldErrors.budgetMinor = `Total task payouts (${totalTasksBudgetMinor} cents) cannot exceed campaign budget (${budgetMinor} cents).`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Please correct the errors in the campaign form.", fieldErrors };
  }

  return {
    ok: true,
    data: {
      ownerId,
      title,
      slug,
      description,
      budgetMinor: budgetMinor!,
      currency: "USD",
      tasks: parsedTasks,
    },
  };
}

export function parseFundCampaign(input: unknown): ValidationResult<FundCampaignInput> {
  if (!isRecord(input)) {
    return { ok: false, message: "Invalid funding data.", fieldErrors: {} };
  }
  const fieldErrors: Record<string, string> = {};
  for (const key of ["note", "rejectionReason"]) {
    if (input[key] !== undefined && (typeof input[key] !== "string" || input[key].length > 1000)) {
      fieldErrors[key] = "Text must be at most 1000 characters.";
    }
  }
  const campaignId = typeof input.campaignId === "string" ? input.campaignId.trim() : "";
  if (!campaignId || campaignId.length > 200) {
    fieldErrors.campaignId = "Campaign ID is required.";
  }

  const amountMinor =
    typeof input.amountMinor === "number"
      ? input.amountMinor
      : typeof input.amountMinor === "string" && /^\d+$/.test(input.amountMinor.trim())
        ? Number(input.amountMinor.trim())
        : null;

  if (amountMinor === null || !Number.isSafeInteger(amountMinor) || amountMinor < 100 || amountMinor > 2_147_483_647) {
    fieldErrors.amountMinor = "Funding amount must be at least $1.00 (100 cents).";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Check funding inputs.", fieldErrors };
  }

  return {
    ok: true,
    data: {
      campaignId,
      amountMinor: amountMinor!,
      note: typeof input.note === "string" ? input.note.trim() : undefined,
    },
  };
}

export function parseCreateSubmission(
  input: unknown,
  userId: string,
): ValidationResult<CreateSubmissionInput> {
  if (!isRecord(input)) {
    return { ok: false, message: "Invalid submission data.", fieldErrors: {} };
  }
  const fieldErrors: Record<string, string> = {};
  for (const key of ["note", "rejectionReason"]) {
    if (input[key] !== undefined && (typeof input[key] !== "string" || input[key].length > 1000)) {
      fieldErrors[key] = "Text must be at most 1000 characters.";
    }
  }
  const taskId = typeof input.taskId === "string" ? input.taskId.trim() : "";
  if (!taskId || taskId.length > 200) {
    fieldErrors.taskId = "Task ID is required.";
  }

  const proofUrl = typeof input.proofUrl === "string" ? input.proofUrl.trim() : "";
  if (!proofUrl) {
    fieldErrors.proofUrl = "Proof URL is required.";
  } else if (!isValidUrl(proofUrl)) {
    fieldErrors.proofUrl = "Provide a valid web URL starting with http:// or https://.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Check submission inputs.", fieldErrors };
  }

  return { ok: true, data: { taskId, userId, proofUrl } };
}

export function parseReviewSubmission(
  input: unknown,
  reviewerId: string,
): ValidationResult<ReviewSubmissionInput> {
  if (!isRecord(input)) {
    return { ok: false, message: "Invalid review data.", fieldErrors: {} };
  }
  const fieldErrors: Record<string, string> = {};
  for (const key of ["note", "rejectionReason"]) {
    if (input[key] !== undefined && (typeof input[key] !== "string" || input[key].length > 1000)) {
      fieldErrors[key] = "Text must be at most 1000 characters.";
    }
  }
  const submissionId = typeof input.submissionId === "string" ? input.submissionId.trim() : "";
  if (!submissionId || submissionId.length > 200) {
    fieldErrors.submissionId = "Submission ID is required.";
  }

  const decision = input.decision === "approve" || input.decision === "reject" ? input.decision : null;
  if (!decision) {
    fieldErrors.decision = "Decision must be approve or reject.";
  }

  const rejectionReason =
    typeof input.rejectionReason === "string" ? input.rejectionReason.trim() : undefined;
  if (decision === "reject" && (!rejectionReason || rejectionReason.length < 5)) {
    fieldErrors.rejectionReason = "A clear rejection reason of at least 5 characters is required.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Check review inputs.", fieldErrors };
  }

  return {
    ok: true,
    data: {
      submissionId,
      reviewerId,
      decision: decision!,
      note: typeof input.note === "string" ? input.note.trim() : undefined,
      rejectionReason,
    },
  };
}

export function parseAppealSubmission(
  input: unknown,
  userId: string,
): ValidationResult<AppealSubmissionInput> {
  if (!isRecord(input)) {
    return { ok: false, message: "Invalid appeal data.", fieldErrors: {} };
  }
  const fieldErrors: Record<string, string> = {};
  for (const key of ["note", "rejectionReason"]) {
    if (input[key] !== undefined && (typeof input[key] !== "string" || input[key].length > 1000)) {
      fieldErrors[key] = "Text must be at most 1000 characters.";
    }
  }
  const submissionId = typeof input.submissionId === "string" ? input.submissionId.trim() : "";
  if (!submissionId || submissionId.length > 200) {
    fieldErrors.submissionId = "Submission ID is required.";
  }

  const appealReason = typeof input.appealReason === "string" ? input.appealReason.trim() : "";
  if (appealReason.length < 10 || appealReason.length > 1000) {
    fieldErrors.appealReason = "Appeal explanation must be between 10 and 1000 characters.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Check appeal inputs.", fieldErrors };
  }

  return { ok: true, data: { submissionId, userId, appealReason } };
}

export function parseDecideAppeal(
  input: unknown,
  reviewerId: string,
): ValidationResult<DecideAppealInput> {
  if (!isRecord(input)) {
    return { ok: false, message: "Invalid appeal decision data.", fieldErrors: {} };
  }
  const fieldErrors: Record<string, string> = {};
  for (const key of ["note", "rejectionReason"]) {
    if (input[key] !== undefined && (typeof input[key] !== "string" || input[key].length > 1000)) {
      fieldErrors[key] = "Text must be at most 1000 characters.";
    }
  }
  const submissionId = typeof input.submissionId === "string" ? input.submissionId.trim() : "";
  if (!submissionId || submissionId.length > 200) {
    fieldErrors.submissionId = "Submission ID is required.";
  }

  const decision = input.decision === "overturn" || input.decision === "uphold" ? input.decision : null;
  if (!decision) {
    fieldErrors.decision = "Decision must be overturn or uphold.";
  }

  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length < 5 || note.length > 500) {
    fieldErrors.note = "A review note of at least 5 characters is required.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Check appeal decision inputs.", fieldErrors };
  }

  return { ok: true, data: { submissionId, reviewerId, decision: decision!, note } };
}

export function parseModerateCampaign(
  input: unknown,
  moderatorId: string,
): ValidationResult<ModerateCampaignInput> {
  if (!isRecord(input)) {
    return { ok: false, message: "Invalid moderation data.", fieldErrors: {} };
  }
  const fieldErrors: Record<string, string> = {};
  for (const key of ["note", "rejectionReason"]) {
    if (input[key] !== undefined && (typeof input[key] !== "string" || input[key].length > 1000)) {
      fieldErrors[key] = "Text must be at most 1000 characters.";
    }
  }
  const campaignId = typeof input.campaignId === "string" ? input.campaignId.trim() : "";
  if (!campaignId || campaignId.length > 200) {
    fieldErrors.campaignId = "Campaign ID is required.";
  }

  const action =
    input.action === "approve" ||
    input.action === "pause" ||
    input.action === "close" ||
    input.action === "resume"
      ? input.action
      : null;

  if (!action) {
    fieldErrors.action = "Action must be approve, pause, resume, or close.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Check moderation inputs.", fieldErrors };
  }

  return {
    ok: true,
    data: {
      campaignId,
      moderatorId,
      action: action!,
      note: typeof input.note === "string" ? input.note.trim() : undefined,
    },
  };
}
