-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "demoDays" INTEGER,
ADD COLUMN     "demoEndedAt" TIMESTAMP(3),
ADD COLUMN     "demoEndsAt" TIMESTAMP(3),
ADD COLUMN     "demoStartedAt" TIMESTAMP(3),
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- Every company that is on today was, by definition, let in by somebody before
-- this existed. Without this they would all read as "pending" in /admin: off or
-- on, `approvedAt` null means "signed up and never switched on". One that is
-- off today stays null, which is what a company waiting for approval looks like.
UPDATE "Company" SET "approvedAt" = "createdAt" WHERE "isActive" = true;
