-- AlterTable
ALTER TABLE "QuoteEvent" ADD COLUMN     "userId" TEXT,
ADD COLUMN     "userName" TEXT;

-- AddForeignKey
ALTER TABLE "QuoteEvent" ADD CONSTRAINT "QuoteEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

