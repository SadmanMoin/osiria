"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import {
  appealSubmissionAction,
  createCampaignAction,
  decideAppealAction,
  fundCampaignAction,
  moderateCampaignAction,
  reviewSubmissionAction,
  submitTaskProofAction,
  type CampaignFormState,
} from "@/lib/campaigns/actions";

const fieldClass =
  "mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-accent/40 focus:ring-2";

const initialState: CampaignFormState = {};

function StatusMessage({ state }: { state: CampaignFormState }) {
  if (!state.error && !state.message) return null;
  return (
    <p role="alert" className={`text-sm ${state.error ? "text-danger" : "text-teal"}`}>
      {state.error ?? state.message}
    </p>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="mt-1 block text-xs text-danger">{message}</span>;
}

export function CreateCampaignForm() {
  const [state, action, pending] = useActionState(createCampaignAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="block text-sm" htmlFor="campaign-title">
          Campaign Title
        </label>
        <input
          id="campaign-title"
          name="title"
          type="text"
          required
          placeholder="e.g. Osiria Genesis Launch"
          className={fieldClass}
        />
        <FieldError message={state.fieldErrors?.title} />
      </div>

      <div>
        <label className="block text-sm" htmlFor="campaign-slug">
          Unique Slug (URL identifier)
        </label>
        <input
          id="campaign-slug"
          name="slug"
          type="text"
          required
          placeholder="e.g. osiria-genesis"
          className={fieldClass}
        />
        <FieldError message={state.fieldErrors?.slug} />
      </div>

      <div>
        <label className="block text-sm" htmlFor="campaign-description">
          Description
        </label>
        <textarea
          id="campaign-description"
          name="description"
          required
          rows={3}
          placeholder="Tell workers what this campaign promotes..."
          className={fieldClass}
        />
        <FieldError message={state.fieldErrors?.description} />
      </div>

      <div>
        <label className="block text-sm" htmlFor="campaign-budget">
          Campaign Budget ($ USD in cents, e.g. 5000 = $50.00)
        </label>
        <input
          id="campaign-budget"
          name="budgetMinor"
          type="number"
          min={100}
          step={100}
          defaultValue={5000}
          required
          className={fieldClass}
        />
        <FieldError message={state.fieldErrors?.budgetMinor} />
      </div>

      <div className="rounded-xl border border-border/80 bg-background/50 p-4">
        <h3 className="text-sm font-semibold text-accent">Initial Task Details</h3>

        <div className="mt-3">
          <label className="block text-xs" htmlFor="task-platform">
            Platform
          </label>
          <select id="task-platform" name="taskPlatform" defaultValue="X" className={fieldClass}>
            <option value="X">X (Twitter)</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="INSTAGRAM">Instagram</option>
          </select>
        </div>

        <div className="mt-3">
          <label className="block text-xs" htmlFor="task-title">
            Task Title
          </label>
          <input
            id="task-title"
            name="taskTitle"
            type="text"
            required
            placeholder="e.g. Repost the launch announcement"
            className={fieldClass}
          />
          <FieldError message={state.fieldErrors?.["tasks[0].title"]} />
        </div>

        <div className="mt-3">
          <label className="block text-xs" htmlFor="task-instructions">
            Instructions
          </label>
          <textarea
            id="task-instructions"
            name="taskInstructions"
            required
            rows={2}
            placeholder="Detailed instructions for the worker..."
            className={fieldClass}
          />
          <FieldError message={state.fieldErrors?.["tasks[0].instructions"]} />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs" htmlFor="reward-points">
              OP Reward
            </label>
            <input
              id="reward-points"
              name="rewardPoints"
              type="number"
              min={1}
              defaultValue={100}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="block text-xs" htmlFor="reward-amount">
              Payout (cents)
            </label>
            <input
              id="reward-amount"
              name="rewardAmountMinor"
              type="number"
              min={1}
              defaultValue={50}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="block text-xs" htmlFor="slots-total">
              Worker Slots
            </label>
            <input
              id="slots-total"
              name="slotsTotal"
              type="number"
              min={1}
              defaultValue={50}
              className={fieldClass}
            />
          </div>
        </div>
      </div>

      <StatusMessage state={state} />

      <Button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create Campaign"}
      </Button>
    </form>
  );
}

export function FundCampaignForm({ campaignId }: { campaignId: string }) {
  const [state, action, pending] = useActionState(fundCampaignAction, initialState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <div>
        <label className="block text-sm" htmlFor={`fund-amount-${campaignId}`}>
          Deposit to Campaign Budget (cents, e.g. 5000 = $50.00)
        </label>
        <input
          id={`fund-amount-${campaignId}`}
          name="amountMinor"
          type="number"
          min={100}
          step={100}
          defaultValue={2500}
          required
          className={fieldClass}
        />
        <FieldError message={state.fieldErrors?.amountMinor} />
      </div>
      <div>
        <label className="block text-sm" htmlFor={`fund-note-${campaignId}`}>
          Funding Note
        </label>
        <input
          id={`fund-note-${campaignId}`}
          name="note"
          type="text"
          placeholder="e.g. Initial campaign budget allocation"
          className={fieldClass}
        />
      </div>
      <StatusMessage state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Allocating..." : "Allocate Budget"}
      </Button>
    </form>
  );
}

export function SubmitProofForm({ taskId }: { taskId: string }) {
  const [state, action, pending] = useActionState(submitTaskProofAction, initialState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="taskId" value={taskId} />
      <div>
        <label className="block text-sm" htmlFor={`proof-${taskId}`}>
          Proof URL (link to tweet, post, or proof)
        </label>
        <input
          id={`proof-${taskId}`}
          name="proofUrl"
          type="url"
          required
          placeholder="https://x.com/yourhandle/status/123456789"
          className={fieldClass}
        />
        <FieldError message={state.fieldErrors?.proofUrl} />
      </div>
      <StatusMessage state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Submitting..." : "Submit Proof"}
      </Button>
    </form>
  );
}

export function ReviewSubmissionForm({ submissionId }: { submissionId: string }) {
  const [state, action, pending] = useActionState(reviewSubmissionAction, initialState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="submissionId" value={submissionId} />
      <div>
        <label className="block text-xs" htmlFor={`reject-reason-${submissionId}`}>
          Rejection reason (required if rejecting)
        </label>
        <input
          id={`reject-reason-${submissionId}`}
          name="rejectionReason"
          type="text"
          placeholder="e.g. Proof link does not show the requested repost"
          className={fieldClass}
        />
        <FieldError message={state.fieldErrors?.rejectionReason} />
      </div>
      <div>
        <label className="block text-xs" htmlFor={`reviewer-note-${submissionId}`}>
          Reviewer Note (optional)
        </label>
        <input
          id={`reviewer-note-${submissionId}`}
          name="note"
          type="text"
          placeholder="e.g. Verified manually"
          className={fieldClass}
        />
      </div>
      <StatusMessage state={state} />
      <div className="flex gap-2">
        <Button type="submit" name="decision" value="approve" disabled={pending}>
          Approve & Reward
        </Button>
        <Button type="submit" name="decision" value="reject" variant="secondary" disabled={pending}>
          Reject
        </Button>
      </div>
    </form>
  );
}

export function AppealSubmissionForm({ submissionId }: { submissionId: string }) {
  const [state, action, pending] = useActionState(appealSubmissionAction, initialState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="submissionId" value={submissionId} />
      <div>
        <label className="block text-xs font-semibold" htmlFor={`appeal-reason-${submissionId}`}>
          Explain why this rejection was in error (min 10 characters)
        </label>
        <textarea
          id={`appeal-reason-${submissionId}`}
          name="appealReason"
          required
          minLength={10}
          rows={2}
          placeholder="Explain your proof or provide additional context..."
          className={fieldClass}
        />
        <FieldError message={state.fieldErrors?.appealReason} />
      </div>
      <StatusMessage state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Submitting Appeal..." : "Submit Appeal"}
      </Button>
    </form>
  );
}

export function DecideAppealForm({ submissionId }: { submissionId: string }) {
  const [state, action, pending] = useActionState(decideAppealAction, initialState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="submissionId" value={submissionId} />
      <div>
        <label className="block text-xs font-semibold" htmlFor={`appeal-note-${submissionId}`}>
          Appeal Decision Note (min 5 characters)
        </label>
        <input
          id={`appeal-note-${submissionId}`}
          name="note"
          type="text"
          required
          minLength={5}
          placeholder="e.g. Proof was valid upon re-examination"
          className={fieldClass}
        />
        <FieldError message={state.fieldErrors?.note} />
      </div>
      <StatusMessage state={state} />
      <div className="flex gap-2">
        <Button type="submit" name="decision" value="overturn" disabled={pending}>
          Overturn & Approve
        </Button>
        <Button type="submit" name="decision" value="uphold" variant="secondary" disabled={pending}>
          Uphold Rejection
        </Button>
      </div>
    </form>
  );
}

export function ModerateCampaignForm({ campaignId }: { campaignId: string }) {
  const [state, action, pending] = useActionState(moderateCampaignAction, initialState);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="campaignId" value={campaignId} />
      <Button type="submit" name="action" value="approve" disabled={pending}>
        Approve & Open
      </Button>
      <Button type="submit" name="action" value="pause" variant="secondary" disabled={pending}>
        Pause
      </Button>
      <Button type="submit" name="action" value="resume" variant="secondary" disabled={pending}>
        Resume
      </Button>
      <Button type="submit" name="action" value="close" variant="ghost" disabled={pending}>
        Close
      </Button>
      <StatusMessage state={state} />
    </form>
  );
}
