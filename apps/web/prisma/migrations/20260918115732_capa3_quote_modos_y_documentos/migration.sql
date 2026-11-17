-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('ITEMIZED', 'LUMP_SUM');

-- CreateEnum
CREATE TYPE "AcceptanceMode" AS ENUM ('SIMPLE_STATEMENT', 'STATEMENT_WITH_CHECKBOX');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "acceptanceMode" "AcceptanceMode" NOT NULL DEFAULT 'STATEMENT_WITH_CHECKBOX',
ADD COLUMN     "acceptanceStatement" TEXT,
ADD COLUMN     "askAdditionalComments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "askOrderReference" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requireSignature" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "lumpSumAmount" DECIMAL(14,2),
ADD COLUMN     "pricingMode" "PricingMode" NOT NULL DEFAULT 'ITEMIZED',
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "termsDocumentId" TEXT;

-- CreateTable
CREATE TABLE "CompanyDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'application/pdf',
    "size" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyDocument_companyId_isDefault_idx" ON "CompanyDocument"("companyId", "isDefault");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_termsDocumentId_fkey" FOREIGN KEY ("termsDocumentId") REFERENCES "CompanyDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDocument" ADD CONSTRAINT "CompanyDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

