"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import {
  reviewEligibilityAction,
  saveEligibilityRuleAction,
  submitEligibilityAction,
} from "@/lib/eligibility/actions";
import type { PlatformRule } from "@/lib/eligibility/rules";
import type { EligibilityFormState } from "@/lib/eligibility/validation";

const fieldClass =
  "mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-accent/40 focus:ring-2";

const initialState: EligibilityFormState = {};

function Status({ state }: { state: EligibilityFormState }) {
  if (!state.error && !state.message) {
    return null;
  }
  return (
    <p role="alert" className={`text-sm ${state.error ? "text-danger" : "text-teal"}`}>
      {state.error ?? state.message}
    </p>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <span className="mt-1 block text-xs text-danger">{message}</span>;
}

export function EligibilitySettingsForm({ rule }: { rule: PlatformRule }) {
  const [state, action, pending] = useActionState(saveEligibilityRuleAction, initialState);
  const prefix = rule.platform.toLowerCase();

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="platform" value={rule.platform} />
      <label className="flex items-center gap-3 text-sm" htmlFor={`${prefix}-enabled`}>
        <input type="hidden" name="isEnabled" value="false" />
        <input
          id={`${prefix}-enabled`}
          name="isEnabled"
          type="checkbox"
          value="true"
          defaultChecked={rule.isEnabled}
          className="size-4 accent-[var(--color-accent)]"
        />
        Accept checks for {rule.displayName}
      </label>
      <label className="block text-sm" htmlFor={`${prefix}-date`}>
        Account created on or before
        <input
          id={`${prefix}-date`}
          name="accountCreatedOnOrBefore"
          type="date"
          defaultValue={rule.accountCreatedOnOrBefore ?? ""}
          className={fieldClass}
        />
        <FieldError message={state.fieldErrors?.accountCreatedOnOrBefore} />
      </label>
      <label className="block text-sm" htmlFor={`${prefix}-audience`}>
        Minimum audience
        <input
          id={`${prefix}-audience`}
          name="minAudience"
          type="number"
          min={0}
          step={1}
          defaultValue={rule.minAudience ?? ""}
          className={fieldClass}
        />
        <FieldError message={state.fieldErrors?.minAudience} />
      </label>
      <label className="block text-sm" htmlFor={`${prefix}-metric`}>
        Audience counted as
        <select
          id={`${prefix}-metric`}
          name="audienceMetric"
          defaultValue={rule.audienceMetric}
          className={fieldClass}
        >
          <option value="FOLLOWERS">Followers</option>
          <option value="FRIENDS">Friends</option>
        </select>
      </label>
      <label className="block text-sm" htmlFor={`${prefix}-join`}>
        How the thresholds combine
        <select id={`${prefix}-join`} name="ruleJoin" defaultValue={rule.ruleJoin} className={fieldClass}>
          <option value="OR">OR — any threshold can pass</option>
          <option value="AND">AND — every threshold must pass</option>
        </select>
      </label>
      <Status state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : `Save ${rule.displayName}`}
      </Button>
    </form>
  );
}

export function ReviewDecisionForm({ userId, platform }: { userId: string; platform: string }) {
  const [state, action, pending] = useActionState(reviewEligibilityAction, initialState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="platform" value={platform} />
      <label className="block text-sm" htmlFor={`note-${userId}-${platform}`}>
        Review note
        <textarea
          id={`note-${userId}-${platform}`}
          name="note"
          required
          minLength={10}
          maxLength={500}
          rows={3}
          className={fieldClass}
        />
        <FieldError message={state.fieldErrors?.note} />
      </label>
      <Status state={state} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" name="decision" value="approve" disabled={pending}>
          Approve
        </Button>
        <Button type="submit" name="decision" value="reject" variant="secondary" disabled={pending}>
          Reject
        </Button>
      </div>
    </form>
  );
}

export function WorkerEligibilityForm() {
  const [state, action, pending] = useActionState(submitEligibilityAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm" htmlFor="eligibility-platform">
        Platform
        <select id="eligibility-platform" name="platform" defaultValue="X" className={fieldClass} required>
          <option value="X">X</option>
          <option value="FACEBOOK">Facebook</option>
          <option value="INSTAGRAM">Instagram</option>
        </select>
        <FieldError message={state.fieldErrors?.platform} />
      </label>
      <label className="block text-sm" htmlFor="eligibility-handle">
        Handle
        <input
          id="eligibility-handle"
          name="handle"
          type="text"
          required
          minLength={2}
          maxLength={50}
          autoComplete="off"
          placeholder="your.handle"
          className={fieldClass}
        />
        <FieldError message={state.fieldErrors?.handle} />
      </label>
      <Status state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Checking…" : "Check eligibility"}
      </Button>
    </form>
  );
}
