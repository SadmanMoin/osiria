BEGIN;
-- Keep original proofs for human review; canonical keys are populated by the backfill command.
ALTER TABLE "TaskSubmission" ADD COLUMN "normalizedProofUrl" TEXT;
CREATE INDEX "TaskSubmission_normalizedProofUrl_idx" ON "TaskSubmission"("normalizedProofUrl");
ALTER TABLE "FraudEvent" ADD COLUMN "resolvedAt" TIMESTAMP(3), ADD COLUMN "resolution" TEXT, ADD COLUMN "resolvedById" TEXT;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_positive_budget" CHECK ("budgetMinor" > 0);
ALTER TABLE "CampaignTask" ADD CONSTRAINT "CampaignTask_valid_amounts_slots" CHECK ("rewardPoints" > 0 AND "rewardAmountMinor" > 0 AND "slotsTotal" > 0 AND "slotsFilled" >= 0 AND "slotsFilled" <= "slotsTotal");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_positive_amount" CHECK ("amountMinor" > 0);
CREATE UNIQUE INDEX "CampaignBudgetLedger_payout_submission_key" ON "CampaignBudgetLedger"("submissionId") WHERE "reason" = 'PAYOUT';
ALTER TABLE "CampaignBudgetLedger" ADD CONSTRAINT "CampaignBudgetLedger_signed_amount" CHECK (("reason" IN ('FUND', 'RELEASE') AND "amountMinor" > 0) OR ("reason" IN ('RESERVE', 'PAYOUT') AND "amountMinor" < 0) OR ("reason" = 'ADJUSTMENT' AND "amountMinor" <> 0));
COMMIT;
