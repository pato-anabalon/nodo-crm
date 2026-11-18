-- CreateEnum
CREATE TYPE "JobScopeChangeKind" AS ENUM ('ADDED', 'EDITED', 'DELETED');

-- AlterEnum
ALTER TYPE "JobActivityType" ADD VALUE 'SCOPE_CHANGED';

-- AlterTable
ALTER TABLE "JobScopeItem" ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "editedById" TEXT;

-- CreateTable
CREATE TABLE "JobScopeChange" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "scopeItemId" TEXT,
    "kind" "JobScopeChangeKind" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobScopeChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobScopeChange_jobId_createdAt_idx" ON "JobScopeChange"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "JobScopeChange_companyId_idx" ON "JobScopeChange"("companyId");

-- AddForeignKey
ALTER TABLE "JobScopeItem" ADD CONSTRAINT "JobScopeItem_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobScopeChange" ADD CONSTRAINT "JobScopeChange_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobScopeChange" ADD CONSTRAINT "JobScopeChange_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobScopeChange" ADD CONSTRAINT "JobScopeChange_scopeItemId_fkey" FOREIGN KEY ("scopeItemId") REFERENCES "JobScopeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobScopeChange" ADD CONSTRAINT "JobScopeChange_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

