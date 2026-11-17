-- CreateEnum
CREATE TYPE "IngestKeyType" AS ENUM ('PUBLIC', 'SECRET');

-- CreateEnum
CREATE TYPE "IngestOutcome" AS ENUM ('ACCEPTED', 'INVALID_KEY', 'REVOKED_KEY', 'ORIGIN_NOT_ALLOWED', 'RATE_LIMITED', 'PAYLOAD_TOO_LARGE', 'INVALID_PAYLOAD', 'DUPLICATE', 'HONEYPOT');

-- AlterTable
ALTER TABLE "LeadSubmission" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "ingestKeyId" TEXT;

-- CreateTable
CREATE TABLE "IngestKey" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "IngestKeyType" NOT NULL DEFAULT 'PUBLIC',
    "prefix" TEXT NOT NULL,
    "hashedSecret" TEXT NOT NULL,
    "allowedOrigins" TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestAttempt" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "ingestKeyId" TEXT,
    "outcome" "IngestOutcome" NOT NULL,
    "origin" TEXT,
    "ipAddress" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngestKey_hashedSecret_key" ON "IngestKey"("hashedSecret");

-- CreateIndex
CREATE INDEX "IngestKey_companyId_revokedAt_idx" ON "IngestKey"("companyId", "revokedAt");

-- CreateIndex
CREATE INDEX "IngestAttempt_companyId_createdAt_idx" ON "IngestAttempt"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "IngestAttempt_ingestKeyId_createdAt_idx" ON "IngestAttempt"("ingestKeyId", "createdAt");

-- CreateIndex
CREATE INDEX "IngestAttempt_ipAddress_createdAt_idx" ON "IngestAttempt"("ipAddress", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSubmission_companyId_idempotencyKey_key" ON "LeadSubmission"("companyId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "LeadSubmission" ADD CONSTRAINT "LeadSubmission_ingestKeyId_fkey" FOREIGN KEY ("ingestKeyId") REFERENCES "IngestKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestKey" ADD CONSTRAINT "IngestKey_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestKey" ADD CONSTRAINT "IngestKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestAttempt" ADD CONSTRAINT "IngestAttempt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestAttempt" ADD CONSTRAINT "IngestAttempt_ingestKeyId_fkey" FOREIGN KEY ("ingestKeyId") REFERENCES "IngestKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

