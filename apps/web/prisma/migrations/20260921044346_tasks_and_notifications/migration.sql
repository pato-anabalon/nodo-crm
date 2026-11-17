-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
ALTER TYPE "NotificationKind" ADD VALUE 'LEAD_ASSIGNED';
ALTER TYPE "NotificationKind" ADD VALUE 'TASK_ASSIGNED';
ALTER TYPE "NotificationKind" ADD VALUE 'TASK_DUE';
-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "assigneeId" TEXT,
    "createdById" TEXT,
    "leadId" TEXT,
    "quoteId" TEXT,
    "contactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "href" TEXT,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "Task_companyId_assigneeId_completedAt_idx" ON "Task"("companyId", "assigneeId", "completedAt");
-- CreateIndex
CREATE INDEX "Task_companyId_dueAt_idx" ON "Task"("companyId", "dueAt");
-- CreateIndex
CREATE INDEX "Task_leadId_idx" ON "Task"("leadId");
-- CreateIndex
CREATE INDEX "Task_quoteId_idx" ON "Task"("quoteId");
-- CreateIndex
CREATE INDEX "Notification_userId_companyId_readAt_idx" ON "Notification"("userId", "companyId", "readAt");
-- CreateIndex
CREATE INDEX "Notification_companyId_createdAt_idx" ON "Notification"("companyId", "createdAt");
-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_companyId_dedupeKey_key" ON "Notification"("userId", "companyId", "dedupeKey");
-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
