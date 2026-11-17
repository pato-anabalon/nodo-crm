-- AlterTable
ALTER TABLE "QuoteAttachment" ADD COLUMN     "sectionId" TEXT;

-- CreateIndex
CREATE INDEX "QuoteAttachment_sectionId_position_idx" ON "QuoteAttachment"("sectionId", "position");

-- AddForeignKey
ALTER TABLE "QuoteAttachment" ADD CONSTRAINT "QuoteAttachment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "QuoteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
