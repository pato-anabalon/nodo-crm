-- CreateEnum
CREATE TYPE "TaxDisplayMode" AS ENUM ('TAX_EXCLUSIVE_INCLUSIVE_TOTAL', 'TAX_EXCLUSIVE', 'TAX_INCLUSIVE', 'NO_TAX');

-- Replaces `pricesIncludeTax` on Company. Added nullable first so the
-- existing rows can be mapped before the column is required: `true` was
-- always "tax inclusive"; `false` always added tax on top of what was typed,
-- which is `TAX_EXCLUSIVE_INCLUSIVE_TOTAL` under the new, more specific name.
ALTER TABLE "Company" ADD COLUMN "taxDisplayMode" "TaxDisplayMode";

UPDATE "Company"
SET "taxDisplayMode" = CASE
  WHEN "pricesIncludeTax" THEN 'TAX_INCLUSIVE'
  ELSE 'TAX_EXCLUSIVE_INCLUSIVE_TOTAL'
END::"TaxDisplayMode";

ALTER TABLE "Company"
  ALTER COLUMN "taxDisplayMode" SET NOT NULL,
  ALTER COLUMN "taxDisplayMode" SET DEFAULT 'TAX_EXCLUSIVE_INCLUSIVE_TOTAL';

ALTER TABLE "Company" DROP COLUMN "pricesIncludeTax";

-- Same shape for Quote: each quote's own frozen copy carried the same boolean.
ALTER TABLE "Quote" ADD COLUMN "taxDisplayMode" "TaxDisplayMode";

UPDATE "Quote"
SET "taxDisplayMode" = CASE
  WHEN "pricesIncludeTax" THEN 'TAX_INCLUSIVE'
  ELSE 'TAX_EXCLUSIVE_INCLUSIVE_TOTAL'
END::"TaxDisplayMode";

ALTER TABLE "Quote"
  ALTER COLUMN "taxDisplayMode" SET NOT NULL,
  ALTER COLUMN "taxDisplayMode" SET DEFAULT 'TAX_EXCLUSIVE_INCLUSIVE_TOTAL';

ALTER TABLE "Quote" DROP COLUMN "pricesIncludeTax";
