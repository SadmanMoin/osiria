"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { DATABASE_UNAVAILABLE_MESSAGE } from "@/lib/auth/constants";
import { requireArea } from "@/lib/auth/session";
import { getCampaignStore } from "@/lib/campaigns/prisma-store";
import {
  appealSubmissionService,
  createCampaignService,
  decideAppealService,
  fundCampaignService,
  moderateCampaignService,
  resolveFraudEventService,
  reviewSubmissionService,
  submitTaskProofService,
} from "@/lib/campaigns/service";
import type { CampaignPlatform } from "@/lib/campaigns/types";

export type CampaignFormState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function formError(message: string, fieldErrors?: Record<string, string>): CampaignFormState {
  return { ok: false, error: message, fieldErrors };
}

export async function createCampaignAction(
  _prev: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  try {
    const user = await requireArea("advertiser", "/advertiser/campaigns");
    if (user === "unavailable") {
      return formError(DATABASE_UNAVAILABLE_MESSAGE);
    }

    const title = formData.get("title")?.toString() ?? "";
    const slug = formData.get("slug")?.toString() ?? "";
    const description = formData.get("description")?.toString() ?? "";
    const budgetMinor = Number(formData.get("budgetMinor") ?? 0);

    const taskPlatform = (formData.get("taskPlatform")?.toString() ?? "X") as CampaignPlatform;
    const taskTitle = formData.get("taskTitle")?.toString() ?? "";
    const taskInstructions = formData.get("taskInstructions")?.toString() ?? "";
    const rewardPoints = Number(formData.get("rewardPoints") ?? 100);
    const rewardAmountMinor = Number(formData.get("rewardAmountMinor") ?? 50);
    const slotsTotal = Number(formData.get("slotsTotal") ?? 10);

    const payload = {
      title,
      slug,
      description,
      budgetMinor,
      tasks: [
        {
          platform: taskPlatform,
          title: taskTitle,
          instructions: taskInstructions,
          rewardPoints,
          rewardAmountMinor,
          slotsTotal,
        },
      ],
    };

    const result = await createCampaignService(
      { id: user.id, role: user.role },
      payload,
      getCampaignStore(),
    );

    if (!result.ok) {
      return formError(result.message, result.fieldErrors);
    }

    revalidatePath("/advertiser");
    revalidatePath("/advertiser/campaigns");
    revalidatePath("/campaigns");
    return { ok: true, message: result.message };
  } catch (error) {
    unstable_rethrow(error);
    return formError(DATABASE_UNAVAILABLE_MESSAGE);
  }
}

export async function fundCampaignAction(
  _prev: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  try {
    const user = await requireArea("advertiser", "/advertiser");
    if (user === "unavailable") {
      return formError(DATABASE_UNAVAILABLE_MESSAGE);
    }

    const campaignId = formData.get("campaignId")?.toString() ?? "";
    const amountMinor = Number(formData.get("amountMinor") ?? 0);
    const note = formData.get("note")?.toString();

    const result = await fundCampaignService(
      { id: user.id, role: user.role },
      { campaignId, amountMinor, note },
      getCampaignStore(),
    );

    if (!result.ok) {
      return formError(result.message, result.fieldErrors);
    }

    revalidatePath("/advertiser");
    revalidatePath(`/advertiser/campaigns/${campaignId}`);
    return { ok: true, message: result.message };
  } catch (error) {
    unstable_rethrow(error);
    return formError(DATABASE_UNAVAILABLE_MESSAGE);
  }
}

export async function submitTaskProofAction(
  _prev: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  try {
    const user = await requireArea("worker", "/worker");
    if (user === "unavailable") {
      return formError(DATABASE_UNAVAILABLE_MESSAGE);
    }

    const taskId = formData.get("taskId")?.toString() ?? "";
    const proofUrl = formData.get("proofUrl")?.toString() ?? "";

    const result = await submitTaskProofService(
      { id: user.id, role: user.role },
      { taskId, proofUrl },
      getCampaignStore(),
    );

    if (!result.ok) {
      return formError(result.message, result.fieldErrors);
    }

    revalidatePath("/worker");
    revalidatePath("/worker/submissions");
    revalidatePath("/campaigns");
    return { ok: true, message: result.message };
  } catch (error) {
    unstable_rethrow(error);
    return formError(DATABASE_UNAVAILABLE_MESSAGE);
  }
}

export async function reviewSubmissionAction(
  _prev: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  try {
    const user = await requireArea("advertiser", "/advertiser/reviews");
    if (user === "unavailable") {
      return formError(DATABASE_UNAVAILABLE_MESSAGE);
    }

    const submissionId = formData.get("submissionId")?.toString() ?? "";
    const decision = formData.get("decision")?.toString() as "approve" | "reject";
    const note = formData.get("note")?.toString();
    const rejectionReason = formData.get("rejectionReason")?.toString();

    const result = await reviewSubmissionService(
      { id: user.id, role: user.role },
      { submissionId, decision, note, rejectionReason },
      getCampaignStore(),
    );

    if (!result.ok) {
      return formError(result.message, result.fieldErrors);
    }

    revalidatePath("/advertiser/reviews");
    revalidatePath("/admin/submissions");
    revalidatePath("/worker/submissions");
    return { ok: true, message: result.message };
  } catch (error) {
    unstable_rethrow(error);
    return formError(DATABASE_UNAVAILABLE_MESSAGE);
  }
}

export async function appealSubmissionAction(
  _prev: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  try {
    const user = await requireArea("worker", "/worker/submissions");
    if (user === "unavailable") {
      return formError(DATABASE_UNAVAILABLE_MESSAGE);
    }

    const submissionId = formData.get("submissionId")?.toString() ?? "";
    const appealReason = formData.get("appealReason")?.toString() ?? "";

    const result = await appealSubmissionService(
      { id: user.id, role: user.role },
      { submissionId, appealReason },
      getCampaignStore(),
    );

    if (!result.ok) {
      return formError(result.message, result.fieldErrors);
    }

    revalidatePath("/worker/submissions");
    revalidatePath("/advertiser/reviews");
    revalidatePath("/admin/submissions");
    return { ok: true, message: result.message };
  } catch (error) {
    unstable_rethrow(error);
    return formError(DATABASE_UNAVAILABLE_MESSAGE);
  }
}

export async function decideAppealAction(
  _prev: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  try {
    const user = await requireArea("admin", "/admin/submissions");
    if (user === "unavailable") {
      return formError(DATABASE_UNAVAILABLE_MESSAGE);
    }

    const submissionId = formData.get("submissionId")?.toString() ?? "";
    const decision = formData.get("decision")?.toString() as "overturn" | "uphold";
    const note = formData.get("note")?.toString() ?? "";

    const result = await decideAppealService(
      { id: user.id, role: user.role },
      { submissionId, decision, note },
      getCampaignStore(),
    );

    if (!result.ok) {
      return formError(result.message, result.fieldErrors);
    }

    revalidatePath("/admin/submissions");
    revalidatePath("/worker/submissions");
    return { ok: true, message: result.message };
  } catch (error) {
    unstable_rethrow(error);
    return formError(DATABASE_UNAVAILABLE_MESSAGE);
  }
}

export async function moderateCampaignAction(
  _prev: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  try {
    const user = await requireArea("admin", "/admin/campaigns");
    if (user === "unavailable") {
      return formError(DATABASE_UNAVAILABLE_MESSAGE);
    }

    const campaignId = formData.get("campaignId")?.toString() ?? "";
    const action = formData.get("action")?.toString() as "approve" | "pause" | "close" | "resume";
    const note = formData.get("note")?.toString();

    const result = await moderateCampaignService(
      { id: user.id, role: user.role },
      { campaignId, action, note },
      getCampaignStore(),
    );

    if (!result.ok) {
      return formError(result.message, result.fieldErrors);
    }

    revalidatePath("/admin/campaigns");
    revalidatePath("/campaigns");
    return { ok: true, message: result.message };
  } catch (error) {
    unstable_rethrow(error);
    return formError(DATABASE_UNAVAILABLE_MESSAGE);
  }
}

export async function resolveFraudAction(
  _prev: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  try {
    const user = await requireArea("admin", "/admin/fraud");
    if (user === "unavailable") {
      return formError(DATABASE_UNAVAILABLE_MESSAGE);
    }

    const eventId = formData.get("eventId")?.toString() ?? "";
    const action = formData.get("action")?.toString() as "DISMISS" | "CONFIRM";
    const note = formData.get("note")?.toString();

    const result = await resolveFraudEventService(
      { id: user.id, role: user.role },
      eventId,
      action,
      note,
      getCampaignStore(),
    );

    if (!result.ok) {
      return formError(result.message);
    }

    revalidatePath("/admin/fraud");
    revalidatePath("/admin/submissions");
    return { ok: true, message: result.message };
  } catch (error) {
    unstable_rethrow(error);
    return formError(DATABASE_UNAVAILABLE_MESSAGE);
  }
}
