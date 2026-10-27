-- CreateEnum
CREATE TYPE "LeadAccessKind" AS ENUM ('VIEWED', 'UPDATED');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'ACTION_SCHEDULED';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "sourceDetail" TEXT;

-- AlterTable
ALTER TABLE "LeadAttachment" ADD COLUMN     "uploadedById" TEXT;

-- CreateTable
CREATE TABLE "LeadSourceOption" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadSourceOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadAccessLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "LeadAccessKind" NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadSourceOption_companyId_position_idx" ON "LeadSourceOption"("companyId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSourceOption_companyId_label_key" ON "LeadSourceOption"("companyId", "label");

-- CreateIndex
CREATE INDEX "LeadAccessLog_companyId_leadId_createdAt_idx" ON "LeadAccessLog"("companyId", "leadId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadAccessLog_leadId_userId_kind_createdAt_idx" ON "LeadAccessLog"("leadId", "userId", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "LeadSourceOption" ADD CONSTRAINT "LeadSourceOption_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAccessLog" ADD CONSTRAINT "LeadAccessLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAccessLog" ADD CONSTRAINT "LeadAccessLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAccessLog" ADD CONSTRAINT "LeadAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAttachment" ADD CONSTRAINT "LeadAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

