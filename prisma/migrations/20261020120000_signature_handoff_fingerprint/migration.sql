-- CreateEnum
CREATE TYPE "SignatureDevice" AS ENUM ('THIS_DEVICE', 'TOUCH_DEVICE');

-- AlterTable
ALTER TABLE "QuoteAcceptance" ADD COLUMN     "recordDigest" TEXT,
ADD COLUMN     "signatureDevice" "SignatureDevice",
ADD COLUMN     "signatureDeviceIp" TEXT,
ADD COLUMN     "signatureDeviceUserAgent" TEXT,
ADD COLUMN     "signatureDigest" TEXT,
ADD COLUMN     "verifiedEmail" BOOLEAN;

-- CreateTable
CREATE TABLE "SignatureHandoff" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "recipientId" TEXT,
    "hashedToken" TEXT NOT NULL,
    "paths" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deviceUserAgent" TEXT,
    "deviceIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureHandoff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignatureHandoff_hashedToken_key" ON "SignatureHandoff"("hashedToken");

-- CreateIndex
CREATE INDEX "SignatureHandoff_companyId_idx" ON "SignatureHandoff"("companyId");

-- CreateIndex
CREATE INDEX "SignatureHandoff_quoteId_idx" ON "SignatureHandoff"("quoteId");

-- AddForeignKey
ALTER TABLE "SignatureHandoff" ADD CONSTRAINT "SignatureHandoff_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureHandoff" ADD CONSTRAINT "SignatureHandoff_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureHandoff" ADD CONSTRAINT "SignatureHandoff_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "QuoteRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

