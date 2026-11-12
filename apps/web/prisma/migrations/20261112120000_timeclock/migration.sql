-- CreateEnum
CREATE TYPE "TimeEntrySource" AS ENUM ('MOBILE', 'MANUAL');

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "locationConsentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "jobName" TEXT NOT NULL,
    "source" "TimeEntrySource" NOT NULL DEFAULT 'MOBILE',
    "clientId" TEXT,
    "clockInAt" TIMESTAMP(3) NOT NULL,
    "clockInReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockInLatitude" DOUBLE PRECISION,
    "clockInLongitude" DOUBLE PRECISION,
    "clockInAccuracyM" DOUBLE PRECISION,
    "clockInDistanceM" DOUBLE PRECISION,
    "clockInBattery" DOUBLE PRECISION,
    "clockOutAt" TIMESTAMP(3),
    "clockOutReceivedAt" TIMESTAMP(3),
    "clockOutLatitude" DOUBLE PRECISION,
    "clockOutLongitude" DOUBLE PRECISION,
    "clockOutAccuracyM" DOUBLE PRECISION,
    "clockOutDistanceM" DOUBLE PRECISION,
    "clockOutInside" BOOLEAN,
    "clockOutBattery" DOUBLE PRECISION,
    "note" TEXT,
    "createdById" TEXT,
    "editedById" TEXT,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationPing" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracyM" DOUBLE PRECISION NOT NULL,
    "speedMps" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationPing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeEntry_companyId_userId_clockInAt_idx" ON "TimeEntry"("companyId", "userId", "clockInAt");

-- CreateIndex
CREATE INDEX "TimeEntry_companyId_clockInAt_idx" ON "TimeEntry"("companyId", "clockInAt");

-- CreateIndex
CREATE INDEX "TimeEntry_jobId_idx" ON "TimeEntry"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeEntry_companyId_clientId_key" ON "TimeEntry"("companyId", "clientId");

-- CreateIndex
CREATE INDEX "LocationPing_companyId_recordedAt_idx" ON "LocationPing"("companyId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LocationPing_timeEntryId_recordedAt_key" ON "LocationPing"("timeEntryId", "recordedAt");

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationPing" ADD CONSTRAINT "LocationPing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationPing" ADD CONSTRAINT "LocationPing_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "TimeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Written by hand: what Prisma can't declare.

-- One open shift per person per company. Per company rather than per person,
-- so a refusal can't tell one company that somebody is clocked in at another.
CREATE UNIQUE INDEX "TimeEntry_one_open" ON "TimeEntry"("companyId", "userId") WHERE "clockOutAt" IS NULL;

-- A shift ends after it starts.
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_out_after_in" CHECK ("clockOutAt" IS NULL OR "clockOutAt" >= "clockInAt");

-- A punch from the phone carries the phone's id for it, which is what makes sending it twice harmless.
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_mobile_client_id" CHECK ("source" <> 'MOBILE' OR "clientId" IS NOT NULL);

-- A battery level is a fraction.
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_battery" CHECK (
  ("clockInBattery" IS NULL OR "clockInBattery" BETWEEN 0 AND 1) AND
  ("clockOutBattery" IS NULL OR "clockOutBattery" BETWEEN 0 AND 1)
);
