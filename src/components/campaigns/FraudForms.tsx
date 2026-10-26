"use client";

import { useActionState } from "react";
import { resolveFraudAction } from "@/lib/campaigns/actions";
import { Button } from "@/components/ui/Button";

export function ResolveFraudForm({
  eventId,
  severity,
}: {
  eventId: string;
  severity: string;
}) {
  const [state, formAction, pending] = useActionState(resolveFraudAction, {});

  return (
    <form action={formAction} className="mt-3 space-y-3 rounded-md border border-border/60 bg-surface/50 p-3">
      <input type="hidden" name="eventId" value={eventId} />
      <div>
        <label className="block text-xs font-medium text-muted">Moderator Resolution Note (Required)</label>
        <input
          type="text"
          name="note"
          required
          minLength={10}
          maxLength={1000}
          placeholder="Reason for dismissal or confirmation..."
          className="mt-1 w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted/60"
        />
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="submit"
          name="action"
          value="DISMISS"
          variant="secondary"
          disabled={pending}
        >
          {pending ? "Processing..." : "Dismiss (False Positive)"}
        </Button>

        <Button
          type="submit"
          name="action"
          value="CONFIRM"
          variant="primary"
          disabled={pending}
        >
          {pending ? "Processing..." : `Confirm Fraud (${severity})`}
        </Button>
      </div>

      {state.error && <p className="text-xs text-red-400">{state.error}</p>}
      {state.message && <p className="text-xs text-green-400">{state.message}</p>}
    </form>
  );
}
