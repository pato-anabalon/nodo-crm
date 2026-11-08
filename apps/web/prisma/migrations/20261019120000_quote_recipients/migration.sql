-- AlterTable
ALTER TABLE "QuoteShareToken" ADD COLUMN     "recipientId" TEXT;

-- AlterTable
ALTER TABLE "QuoteEvent" ADD COLUMN     "recipientEmail" TEXT,
ADD COLUMN     "recipientName" TEXT;

-- AlterTable
ALTER TABLE "QuoteMessage" ADD COLUMN     "authorName" TEXT;

-- CreateTable
CREATE TABLE "QuoteRecipient" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "contactId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteRecipient_companyId_idx" ON "QuoteRecipient"("companyId");

-- CreateIndex
CREATE INDEX "QuoteRecipient_contactId_idx" ON "QuoteRecipient"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteRecipient_quoteId_email_key" ON "QuoteRecipient"("quoteId", "email");

-- CreateIndex
CREATE INDEX "QuoteShareToken_recipientId_idx" ON "QuoteShareToken"("recipientId");

-- AddForeignKey
ALTER TABLE "QuoteShareToken" ADD CONSTRAINT "QuoteShareToken_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "QuoteRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRecipient" ADD CONSTRAINT "QuoteRecipient_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRecipient" ADD CONSTRAINT "QuoteRecipient_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRecipient" ADD CONSTRAINT "QuoteRecipient_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- One primary per quote. Prisma has no way to declare a partial unique index,
-- so it lives here; the schema's comment on QuoteRecipient points at it.
CREATE UNIQUE INDEX "QuoteRecipient_one_primary_per_quote"
  ON "QuoteRecipient"("quoteId") WHERE "isPrimary";

-- Every quote that already has somebody to write to gets them as its primary
-- recipient, so sending, the portal and the log read one shape from here on.
-- The address is normalised the way normaliseEmail() does; the contact is
-- linked only when the lead's contact really is that address.
INSERT INTO "QuoteRecipient" ("id", "companyId", "quoteId", "contactId", "name", "email", "isPrimary", "position", "createdAt")
SELECT
  gen_random_uuid()::text,
  q."companyId",
  q."id",
  c."id",
  COALESCE(NULLIF(TRIM(q."clientName"), ''), LOWER(TRIM(q."clientEmail"))),
  LOWER(TRIM(q."clientEmail")),
  true,
  0,
  q."createdAt"
FROM "Quote" q
LEFT JOIN "Lead" l ON l."id" = q."leadId"
LEFT JOIN "Contact" c ON c."id" = l."contactId"
  AND LOWER(TRIM(c."email")) = LOWER(TRIM(q."clientEmail"))
WHERE NULLIF(TRIM(q."clientEmail"), '') IS NOT NULL;
