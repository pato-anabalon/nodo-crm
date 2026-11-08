-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'QUOTE_DECIDED';


-- The history written before the separator was settled.
--
-- Every stored row used an arrow while the reader split on ">", so each one
-- asked for a message key like `leads.status.QUALIFIED → PROPOSAL` and threw.
-- Fixing the writers doesn't fix what is already saved.
UPDATE "Activity"
SET "content" = replace("content", ' → ', '>')
WHERE "type" = 'STATUS_CHANGE' AND "content" LIKE '% → %';

-- One of them is a quote's status change, not the lead's: `Quote #6: SENT → REJECTED`.
UPDATE "Activity"
SET "type" = 'QUOTE_DECIDED',
    "content" = regexp_replace("content", '^Quote #(\d+):\s*\w+>', '\1>')
WHERE "type" = 'STATUS_CHANGE' AND "content" LIKE 'Quote #%';

-- And the seed's trailing sentence, which no translation ever expected.
UPDATE "Activity"
SET "content" = regexp_replace("content", '\s*\(.*\)$', '')
WHERE "type" = 'STATUS_CHANGE' AND "content" LIKE '%(%)';
