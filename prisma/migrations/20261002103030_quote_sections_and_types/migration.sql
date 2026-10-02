-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "QuoteSectionKind" AS ENUM ('INDEPENDENT', 'OPTIONAL', 'MULTIPLE_CHOICE');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "quoteScope" TEXT;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "discountType" "DiscountType" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "discountValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "optionalDiscountThreshold" INTEGER,
ADD COLUMN     "optionalDiscountType" "DiscountType",
ADD COLUMN     "optionalDiscountValue" DECIMAL(14,2),
ADD COLUMN     "projectAddress" TEXT,
ADD COLUMN     "quoteType" TEXT,
ADD COLUMN     "scope" TEXT;

-- AlterTable
ALTER TABLE "QuoteSection" ADD COLUMN     "customerSelected" BOOLEAN,
ADD COLUMN     "discountType" "DiscountType" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "discountValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "kind" "QuoteSectionKind" NOT NULL DEFAULT 'INDEPENDENT',
ADD COLUMN     "selectedByDefault" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "QuoteTemplate" ADD COLUMN     "scope" TEXT;

-- AlterTable
ALTER TABLE "QuoteTemplateSection" ADD COLUMN     "kind" "QuoteSectionKind" NOT NULL DEFAULT 'INDEPENDENT';

-- CreateTable
CREATE TABLE "CompanyQuoteType" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyQuoteType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyQuoteType_companyId_position_idx" ON "CompanyQuoteType"("companyId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyQuoteType_companyId_label_key" ON "CompanyQuoteType"("companyId", "label");

-- AddForeignKey
ALTER TABLE "CompanyQuoteType" ADD CONSTRAINT "CompanyQuoteType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Data backfill: the raw input that produced the already-frozen `discount`
-- amount on every existing quote. The column default already made every row
-- FIXED above; this recovers the one piece that default can't supply.
UPDATE "Quote" SET "discountValue" = "discount";

-- Seed every existing company with the three starting quote types, so none
-- of them see an empty picker. New companies get the same three via
-- createCompanyWithOwner, alongside the rest of its starting data.
INSERT INTO "CompanyQuoteType" ("id", "companyId", "label", "position")
SELECT gen_random_uuid()::text, "id", labels.label, labels.position
FROM "Company"
CROSS JOIN (
  VALUES ('Estimate For', 0), ('Quote For', 1), ('Variation For', 2)
) AS labels(label, position);
