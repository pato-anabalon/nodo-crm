-- CreateEnum
CREATE TYPE "TimeEntryKind" AS ENUM ('WORK', 'TRAVEL');

-- CreateEnum
CREATE TYPE "TimeEntryEnd" AS ENUM ('PUNCH', 'LEFT_SITE', 'SWITCHED', 'TRAVEL_LIMIT');

-- CreateEnum
CREATE TYPE "TimeEntryEventKind" AS ENUM ('LEFT', 'RETURNED', 'ERRAND');

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'TIMECLOCK_AUTO_OUT';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "siteReturnMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "siteSwitchMinutes" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "travelMaxMinutes" INTEGER NOT NULL DEFAULT 120;

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "endedBy" "TimeEntryEnd",
ADD COLUMN     "kind" "TimeEntryKind" NOT NULL DEFAULT 'WORK';

-- CreateTable
CREATE TABLE "TimeEntryEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "kind" "TimeEntryEventKind" NOT NULL,
    "clientId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "TimeEntryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeEntryEvent_timeEntryId_at_idx" ON "TimeEntryEvent"("timeEntryId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "TimeEntryEvent_companyId_clientId_key" ON "TimeEntryEvent"("companyId", "clientId");

-- AddForeignKey
ALTER TABLE "TimeEntryEvent" ADD CONSTRAINT "TimeEntryEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntryEvent" ADD CONSTRAINT "TimeEntryEvent_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "TimeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Travel is between jobs, on none of them: its hours can't land on a job's.
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_travel_no_job" CHECK ("kind" <> 'TRAVEL' OR "jobId" IS NULL);

-- The settings are offered from short lists; nothing outside them is a choice.
ALTER TABLE "Company" ADD CONSTRAINT "Company_movement_minutes" CHECK (
  "siteReturnMinutes" BETWEEN 0 AND 240 AND "siteSwitchMinutes" BETWEEN 1 AND 60 AND "travelMaxMinutes" BETWEEN 10 AND 600
);
