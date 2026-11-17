-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "firstFollowUpDays" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "reviewRequestDays" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "secondFollowUpDays" INTEGER NOT NULL DEFAULT 7;

-- CreateTable
CREATE TABLE "ReviewLink" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "source" "ReviewSource" NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteEmail" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "kind" "EmailTemplateKind" NOT NULL,
    "to" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewLink_companyId_idx" ON "ReviewLink"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewLink_companyId_source_key" ON "ReviewLink"("companyId", "source");

-- CreateIndex
CREATE INDEX "QuoteEmail_companyId_idx" ON "QuoteEmail"("companyId");

-- CreateIndex
CREATE INDEX "QuoteEmail_quoteId_idx" ON "QuoteEmail"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteEmail_quoteId_kind_key" ON "QuoteEmail"("quoteId", "kind");

-- AddForeignKey
ALTER TABLE "ReviewLink" ADD CONSTRAINT "ReviewLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteEmail" ADD CONSTRAINT "QuoteEmail_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

