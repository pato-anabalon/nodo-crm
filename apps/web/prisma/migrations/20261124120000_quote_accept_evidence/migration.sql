-- CreateEnum
CREATE TYPE "QuoteAcceptReason" AS ENUM ('CUSTOMER_EMAIL', 'CUSTOMER_MESSAGE', 'CUSTOMER_CALL', 'IN_PERSON', 'LINK_PROBLEM', 'OTHER');

-- AlterTable
ALTER TABLE "QuoteEvent" ADD COLUMN     "acceptReason" "QuoteAcceptReason";

-- CreateTable
CREATE TABLE "QuoteEventFile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteEventFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuoteEventFile_pathname_key" ON "QuoteEventFile"("pathname");

-- CreateIndex
CREATE INDEX "QuoteEventFile_eventId_idx" ON "QuoteEventFile"("eventId");

-- AddForeignKey
ALTER TABLE "QuoteEventFile" ADD CONSTRAINT "QuoteEventFile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteEventFile" ADD CONSTRAINT "QuoteEventFile_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "QuoteEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

