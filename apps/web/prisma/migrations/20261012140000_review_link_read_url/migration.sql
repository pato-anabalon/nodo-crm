-- AlterTable
ALTER TABLE "ReviewLink" ADD COLUMN     "label" TEXT,
ADD COLUMN     "readUrl" TEXT,
ALTER COLUMN "url" DROP NOT NULL;

