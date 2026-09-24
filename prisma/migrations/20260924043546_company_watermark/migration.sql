-- The image stamped faintly in the corner of the quote the customer reads.
-- Separate from the logo: it is seen through the page, so it is usually a mark
-- or a seal rather than the full lock-up, and a company may well want one
-- without the other.
--
-- Nullable and with no backfill: having none is the ordinary state.
ALTER TABLE "Company" ADD COLUMN "watermarkUrl" TEXT;
