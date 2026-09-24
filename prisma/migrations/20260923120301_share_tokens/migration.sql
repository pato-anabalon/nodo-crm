-- Several links may open one quote.
--
-- Hand-ordered: `migrate diff` drops the column before the new table exists,
-- which would take every live customer link with it. The hashes have to move
-- first — they cannot be regenerated, because the tokens they are hashes of
-- exist only in customers' inboxes.

-- CreateTable
CREATE TABLE "QuoteShareToken" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "hashedToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteShareToken_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "QuoteShareToken" ADD CONSTRAINT "QuoteShareToken_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "QuoteShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Move every existing link across, keeping the share's own age so the first
-- token doesn't look newer than the quote it belongs to.
INSERT INTO "QuoteShareToken" ("id", "shareId", "hashedToken", "createdAt")
SELECT gen_random_uuid()::text, "id", "hashedToken", "createdAt"
FROM "QuoteShare";

-- CreateIndex
CREATE UNIQUE INDEX "QuoteShareToken_hashedToken_key" ON "QuoteShareToken"("hashedToken");

-- CreateIndex
CREATE INDEX "QuoteShareToken_shareId_idx" ON "QuoteShareToken"("shareId");

-- Only now that the hashes are safely on the other side.
-- DropIndex
DROP INDEX "QuoteShare_hashedToken_key";

-- AlterTable
ALTER TABLE "QuoteShare" DROP COLUMN "hashedToken";
