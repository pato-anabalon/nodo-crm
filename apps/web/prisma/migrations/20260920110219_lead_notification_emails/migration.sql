-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "leadNotificationEmails" TEXT[] DEFAULT ARRAY[]::TEXT[];
