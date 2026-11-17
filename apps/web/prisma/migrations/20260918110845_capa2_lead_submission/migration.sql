-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'RECEIVED';
ALTER TYPE "ActivityType" ADD VALUE 'ASSIGNED';
ALTER TYPE "ActivityType" ADD VALUE 'DISCARDED';
ALTER TYPE "ActivityType" ADD VALUE 'RESTORED';
ALTER TYPE "ActivityType" ADD VALUE 'CONVERTED';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "discardReason" TEXT,
ADD COLUMN     "discardedAt" TIMESTAMP(3),
ADD COLUMN     "discardedById" TEXT;

-- CreateTable
CREATE TABLE "LeadSubmission" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "companyName" TEXT,
    "message" TEXT,
    "serviceType" TEXT,
    "address" TEXT,
    "sourceUrl" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadSubmission_leadId_key" ON "LeadSubmission"("leadId");

-- CreateIndex
CREATE INDEX "LeadSubmission_companyId_receivedAt_idx" ON "LeadSubmission"("companyId", "receivedAt");

-- CreateIndex
CREATE INDEX "LeadSubmission_companyId_email_idx" ON "LeadSubmission"("companyId", "email");

-- CreateIndex
CREATE INDEX "Lead_companyId_discardedAt_idx" ON "Lead"("companyId", "discardedAt");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_discardedById_fkey" FOREIGN KEY ("discardedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSubmission" ADD CONSTRAINT "LeadSubmission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSubmission" ADD CONSTRAINT "LeadSubmission_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

