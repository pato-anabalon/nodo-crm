
-- CreateEnum
CREATE TYPE "TimesheetChangeKind" AS ENUM ('SHIFT_ADDED', 'SHIFT_CORRECTED', 'SHIFT_DELETED', 'MEAL_ADJUSTED');

-- CreateTable
CREATE TABLE "TimesheetDay" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "mealBreakMinutes" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "editedById" TEXT,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimesheetDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetChange" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timeEntryId" TEXT,
    "day" DATE NOT NULL,
    "kind" "TimesheetChangeKind" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimesheetChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetDay_companyId_userId_day_key" ON "TimesheetDay"("companyId", "userId", "day");

-- CreateIndex
CREATE INDEX "TimesheetChange_companyId_userId_day_idx" ON "TimesheetChange"("companyId", "userId", "day");

-- CreateIndex
CREATE INDEX "TimesheetChange_timeEntryId_idx" ON "TimesheetChange"("timeEntryId");

-- AddForeignKey
ALTER TABLE "TimesheetDay" ADD CONSTRAINT "TimesheetDay_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetDay" ADD CONSTRAINT "TimesheetDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetDay" ADD CONSTRAINT "TimesheetDay_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetChange" ADD CONSTRAINT "TimesheetChange_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetChange" ADD CONSTRAINT "TimesheetChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetChange" ADD CONSTRAINT "TimesheetChange_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "TimeEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetChange" ADD CONSTRAINT "TimesheetChange_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A meal break adjusted by hand is a real break, never negative and never a whole day.
ALTER TABLE "TimesheetDay" ADD CONSTRAINT "TimesheetDay_meal_minutes" CHECK ("mealBreakMinutes" BETWEEN 0 AND 240);
