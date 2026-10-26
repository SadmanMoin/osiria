"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { DATABASE_UNAVAILABLE_MESSAGE } from "@/lib/auth/constants";
import { requireArea } from "@/lib/auth/session";
import { getEligibilityStore } from "@/lib/eligibility/prisma-store";
import {
  decideReview,
  savePlatformRules,
  submitEligibilityCheck,
  unconfiguredProfileSource,
} from "@/lib/eligibility/service";
import type { EligibilityFormState } from "@/lib/eligibility/validation";

function formError(message: string, fieldErrors?: Record<string, string>): EligibilityFormState {
  return { error: message, fieldErrors };
}

export async function saveEligibilityRuleAction(
  _state: EligibilityFormState,
  formData: FormData,
): Promise<EligibilityFormState> {
  try {
    const user = await requireArea("admin", "/admin/eligibility");
    if (user === "unavailable") {
      return formError(DATABASE_UNAVAILABLE_MESSAGE);
    }
    const store = getEligibilityStore();
    const result = await savePlatformRules(
      { id: user.id, role: user.role },
      {
        platform: formData.get("platform"),
        isEnabled: formData.getAll("isEnabled"),
        accountCreatedOnOrBefore: formData.get("accountCreatedOnOrBefore"),
        minAudience: formData.get("minAudience"),
        ruleJoin: formData.get("ruleJoin"),
        audienceMetric: formData.get("audienceMetric"),
      },
      store,
    );
    if (!result.ok) {
      return formError(result.message, result.fieldErrors);
    }
    revalidatePath("/admin/eligibility");
    return { message: "Eligibility settings saved." };
  } catch (error) {
    unstable_rethrow(error);
    return formError(DATABASE_UNAVAILABLE_MESSAGE);
  }
}

export async function reviewEligibilityAction(
  _state: EligibilityFormState,
  formData: FormData,
): Promise<EligibilityFormState> {
  try {
    const user = await requireArea("admin", "/admin/eligibility/reviews");
    if (user === "unavailable") {
      return formError(DATABASE_UNAVAILABLE_MESSAGE);
    }
    const result = await decideReview(
      { id: user.id, role: user.role },
      {
        userId: formData.get("userId"),
        platform: formData.get("platform"),
        decision: formData.get("decision"),
        note: formData.get("note"),
      },
      getEligibilityStore(),
    );
    if (!result.ok) {
      return formError(result.message, result.fieldErrors);
    }
    revalidatePath("/admin/eligibility/reviews");
    revalidatePath("/worker/eligibility");
    return {
      message:
        result.check.status === "ELIGIBLE"
          ? "Approved. No profile metrics were added."
          : "Rejected. The stored profile metrics were left unchanged.",
    };
  } catch (error) {
    unstable_rethrow(error);
    return formError(DATABASE_UNAVAILABLE_MESSAGE);
  }
}

export async function submitEligibilityAction(
  _state: EligibilityFormState,
  formData: FormData,
): Promise<EligibilityFormState> {
  try {
    const user = await requireArea("worker", "/worker/eligibility");
    if (user === "unavailable") {
      return formError(DATABASE_UNAVAILABLE_MESSAGE);
    }
    const result = await submitEligibilityCheck(
      { id: user.id, role: user.role },
      { platform: formData.get("platform"), handle: formData.get("handle") },
      getEligibilityStore(),
      unconfiguredProfileSource,
    );
    if (!result.ok) {
      return formError(result.message, result.fieldErrors);
    }
    revalidatePath("/worker/eligibility");
    revalidatePath("/admin/eligibility/reviews");
    return { message: `${result.message} ${result.check.reasons.join(" ")}` };
  } catch (error) {
    unstable_rethrow(error);
    return formError(DATABASE_UNAVAILABLE_MESSAGE);
  }
}
