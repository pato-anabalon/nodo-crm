-- The company's default terms for a quote, alongside the introduction, notes
-- and exclusions it already had. Nullable and with no backfill: no row means
-- the company has set none, which is what every existing one is.
--
-- Quotes already issued are untouched. They carry their own copy of the text,
-- as they do for every other setting frozen at creation.
ALTER TABLE "Company" ADD COLUMN "quoteTerms" TEXT;
