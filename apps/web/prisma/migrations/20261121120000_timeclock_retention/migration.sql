-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'TIMECLOCK_LEFT_OPEN';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "locationRetentionDays" INTEGER NOT NULL DEFAULT 180;

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "track" TEXT;

-- A retention the settings never offer, and none at all, are both mistakes.
ALTER TABLE "Company" ADD CONSTRAINT "Company_location_retention" CHECK ("locationRetentionDays" BETWEEN 7 AND 730);
