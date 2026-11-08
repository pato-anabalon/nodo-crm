-- CreateEnum
CREATE TYPE "EmailTemplateKind" AS ENUM ('NEW_QUOTE', 'QUOTE_ACCEPTED', 'FIRST_FOLLOW_UP', 'SECOND_FOLLOW_UP', 'REVIEW_REQUEST');

-- CreateEnum
CREATE TYPE "SenderNameStyle" AS ENUM ('COMPANY', 'USER', 'USER_AND_COMPANY');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "sendQuoteCopy" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "senderNameStyle" "SenderNameStyle" NOT NULL DEFAULT 'COMPANY',
ADD COLUMN     "slogan" TEXT;

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "EmailTemplateKind" NOT NULL,
    "subject" TEXT,
    "bodyHtml" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailTemplate_companyId_idx" ON "EmailTemplate"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_companyId_kind_key" ON "EmailTemplate"("companyId", "kind");

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

