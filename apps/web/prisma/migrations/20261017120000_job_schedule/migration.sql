-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobActivityType" ADD VALUE 'EVENT_CREATED';
ALTER TYPE "JobActivityType" ADD VALUE 'EVENT_COMMENTED';

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'JOB_EVENT';

-- AlterTable
ALTER TABLE "JobComment" ADD COLUMN     "eventId" TEXT;

-- CreateTable
CREATE TABLE "JobEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobEventParticipant" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobEventParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobEvent_companyId_jobId_startsOn_idx" ON "JobEvent"("companyId", "jobId", "startsOn");

-- CreateIndex
CREATE INDEX "JobEvent_companyId_isMilestone_startsOn_idx" ON "JobEvent"("companyId", "isMilestone", "startsOn");

-- CreateIndex
CREATE INDEX "JobEventParticipant_companyId_userId_idx" ON "JobEventParticipant"("companyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "JobEventParticipant_eventId_userId_key" ON "JobEventParticipant"("eventId", "userId");

-- CreateIndex
CREATE INDEX "JobComment_eventId_idx" ON "JobComment"("eventId");

-- AddForeignKey
ALTER TABLE "JobComment" ADD CONSTRAINT "JobComment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "JobEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEvent" ADD CONSTRAINT "JobEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEvent" ADD CONSTRAINT "JobEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEvent" ADD CONSTRAINT "JobEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEventParticipant" ADD CONSTRAINT "JobEventParticipant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEventParticipant" ADD CONSTRAINT "JobEventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "JobEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEventParticipant" ADD CONSTRAINT "JobEventParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A comment is about exactly one thing: a post, a to-do, a to-do list or an event.
ALTER TABLE "JobComment" DROP CONSTRAINT "JobComment_one_subject";
ALTER TABLE "JobComment" ADD CONSTRAINT "JobComment_one_subject" CHECK (num_nonnulls("postId", "todoId", "todoListId", "eventId") = 1);

-- An event ends on or after the day it starts, and a timed one carries both instants.
ALTER TABLE "JobEvent" ADD CONSTRAINT "JobEvent_days_in_order" CHECK ("endsOn" >= "startsOn");
ALTER TABLE "JobEvent" ADD CONSTRAINT "JobEvent_times_match_kind" CHECK (
  ("allDay" AND "startsAt" IS NULL AND "endsAt" IS NULL)
  OR (NOT "allDay" AND "startsAt" IS NOT NULL AND "endsAt" IS NOT NULL AND "endsAt" >= "startsAt")
);
