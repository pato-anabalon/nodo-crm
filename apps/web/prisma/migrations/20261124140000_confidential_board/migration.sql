
-- CreateEnum
CREATE TYPE "JobBoard" AS ENUM ('TEAM', 'CONFIDENTIAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobActivityType" ADD VALUE 'CONFIDENTIAL_POST_PUBLISHED';
ALTER TYPE "JobActivityType" ADD VALUE 'CONFIDENTIAL_COMMENT_ADDED';

-- DropIndex
DROP INDEX "JobPost_companyId_jobId_publishedAt_idx";

-- AlterTable
ALTER TABLE "JobPost" ADD COLUMN     "board" "JobBoard" NOT NULL DEFAULT 'TEAM';

-- CreateIndex
CREATE INDEX "JobPost_companyId_jobId_board_publishedAt_idx" ON "JobPost"("companyId", "jobId", "board", "publishedAt");

