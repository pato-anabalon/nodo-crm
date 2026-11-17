-- CreateTable
CREATE TABLE "JobScopeItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobScopeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobScopeItem_jobId_position_idx" ON "JobScopeItem"("jobId", "position");

-- CreateIndex
CREATE INDEX "JobScopeItem_companyId_idx" ON "JobScopeItem"("companyId");

-- AddForeignKey
ALTER TABLE "JobScopeItem" ADD CONSTRAINT "JobScopeItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobScopeItem" ADD CONSTRAINT "JobScopeItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

