-- CreateEnum
CREATE TYPE "QuoteDeclineReason" AS ENUM ('CUSTOMER_DECLINED', 'OTHER_COMPANY', 'PRICE', 'NOT_GOING_AHEAD', 'REPLACED', 'SENT_IN_ERROR', 'OTHER');

-- AlterTable
ALTER TABLE "QuoteEvent" ADD COLUMN     "reason" "QuoteDeclineReason",
ADD COLUMN     "reasonNote" TEXT;

