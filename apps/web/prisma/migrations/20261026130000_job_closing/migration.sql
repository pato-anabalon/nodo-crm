-- AlterEnum
ALTER TYPE "JobActivityType" ADD VALUE 'JOB_FINISHED';

-- AlterEnum
ALTER TYPE "JobActivityType" ADD VALUE 'JOB_REOPENED';

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedById" TEXT;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
