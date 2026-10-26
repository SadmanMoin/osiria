-- CreateEnum
CREATE TYPE "EligibilityJoin" AS ENUM ('OR', 'AND');

-- CreateEnum
CREATE TYPE "AudienceMetric" AS ENUM ('FOLLOWERS', 'FRIENDS');

-- CreateEnum
CREATE TYPE "EligibilityStatus" AS ENUM ('PENDING_VERIFICATION', 'ELIGIBLE', 'INELIGIBLE', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "EvidenceAvailability" AS ENUM ('NONE', 'UNAVAILABLE', 'REPORTED');

-- CreateEnum
CREATE TYPE "EligibilityDecisionSource" AS ENUM ('RULES', 'ADMIN');

-- AlterTable
ALTER TABLE "SocialPlatformSetting" ADD COLUMN "accountCreatedOnOrBefore" DATE,
ADD COLUMN "ruleJoin" "EligibilityJoin" NOT NULL DEFAULT 'OR',
ADD COLUMN "audienceMetric" "AudienceMetric" NOT NULL DEFAULT 'FOLLOWERS';

-- CreateTable
CREATE TABLE "SocialEligibility" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "status" "EligibilityStatus" NOT NULL,
    "reasons" JSONB NOT NULL,
    "accountCreatedOn" DATE,
    "audienceCount" INTEGER,
    "evidenceAvailability" "EvidenceAvailability" NOT NULL,
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "decisionSource" "EligibilityDecisionSource" NOT NULL DEFAULT 'RULES',
    "socialAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialEligibility_userId_platform_key" ON "SocialEligibility"("userId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "SocialEligibility_socialAccountId_key" ON "SocialEligibility"("socialAccountId");

-- CreateIndex
CREATE INDEX "SocialEligibility_status_platform_idx" ON "SocialEligibility"("status", "platform");

-- AddForeignKey
ALTER TABLE "SocialEligibility" ADD CONSTRAINT "SocialEligibility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialEligibility" ADD CONSTRAINT "SocialEligibility_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialEligibility" ADD CONSTRAINT "SocialEligibility_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the Phase 4 defaults. ON CONFLICT leaves an admin's later edits in place.
INSERT INTO "SocialPlatformSetting" (
    "id",
    "platform",
    "displayName",
    "isEnabled",
    "verificationRequired",
    "minFollowers",
    "accountCreatedOnOrBefore",
    "ruleJoin",
    "audienceMetric",
    "createdAt",
    "updatedAt"
) VALUES
(
    '11111111-1111-4111-8111-111111111111',
    'X',
    'X',
    true,
    true,
    1000,
    DATE '2022-12-31',
    'OR',
    'FOLLOWERS',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    '22222222-2222-4222-8222-222222222222',
    'FACEBOOK',
    'Facebook',
    true,
    true,
    50,
    NULL,
    'AND',
    'FRIENDS',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    '33333333-3333-4333-8333-333333333333',
    'INSTAGRAM',
    'Instagram',
    true,
    true,
    1000,
    DATE '2022-12-31',
    'OR',
    'FOLLOWERS',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("platform") DO NOTHING;
