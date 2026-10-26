-- AlterEnum
ALTER TYPE "SubmissionStatus" ADD VALUE 'APPEALED';

-- AlterTable
ALTER TABLE "TaskSubmission" ADD COLUMN "rejectionReason" TEXT,
ADD COLUMN "appealReason" TEXT,
ADD COLUMN "appealedAt" TIMESTAMP(3),
ADD COLUMN "appealReviewNote" TEXT;
