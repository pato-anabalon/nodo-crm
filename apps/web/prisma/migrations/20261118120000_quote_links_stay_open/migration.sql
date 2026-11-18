-- Somebody opening a quote that ran out: the team is told, so they can get in touch.
ALTER TYPE "NotificationKind" ADD VALUE 'QUOTE_EXPIRED_OPENED';

-- A customer's link no longer runs out with the quote. Links already sent were
-- given the quote's validUntil; they open again, and the portal shows the quote
-- as expired with nothing to accept.
UPDATE "QuoteShare" SET "expiresAt" = NULL WHERE "expiresAt" IS NOT NULL;
