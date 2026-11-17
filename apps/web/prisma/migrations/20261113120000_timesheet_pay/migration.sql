-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "mealBreakMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "restBreakMinutes" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "hourlyRate" DECIMAL(10,2);


-- Written by hand: what Prisma can't declare.

-- A break lasts something sensible; the meal break may be paid (0).
ALTER TABLE "Company" ADD CONSTRAINT "Company_break_minutes" CHECK (
  "restBreakMinutes" BETWEEN 10 AND 60 AND "mealBreakMinutes" BETWEEN 0 AND 120
);

-- A rate is never negative.
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_hourly_rate" CHECK ("hourlyRate" IS NULL OR "hourlyRate" >= 0);
