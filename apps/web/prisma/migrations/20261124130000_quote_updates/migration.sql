-- AlterEnum
ALTER TYPE "EmailTemplateKind" ADD VALUE 'QUOTE_UPDATED';

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'QUOTE_UPDATED';

-- AlterEnum
ALTER TYPE "QuoteEventType" ADD VALUE 'UPDATED';

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "QuoteEvent" ADD COLUMN     "changes" JSONB,
ADD COLUMN     "customerNotifiedAt" TIMESTAMP(3);

