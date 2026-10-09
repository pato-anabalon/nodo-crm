-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "legacyQuotientNumber" INTEGER;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "legacyQuotientNumber" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Lead_legacyQuotientNumber_key" ON "Lead"("legacyQuotientNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_legacyQuotientNumber_key" ON "Quote"("legacyQuotientNumber");

