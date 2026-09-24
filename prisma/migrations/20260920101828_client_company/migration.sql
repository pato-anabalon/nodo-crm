-- The customer's own company becomes an entity.
--
-- The order matters: the table and the columns first, then the text that was
-- already there is turned into rows, and only then is the old column dropped.
-- Letting `prisma migrate diff` write this untouched would have dropped
-- `Contact.account` before anything read it.

-- CreateTable
CREATE TABLE "ClientCompany" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClientCompany_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientCompany_companyId_idx" ON "ClientCompany"("companyId");
CREATE INDEX "ClientCompany_companyId_name_idx" ON "ClientCompany"("companyId", "name");

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "clientCompanyId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "clientCompanyId" TEXT;

-- Turn the names already typed into rows, one per company and spelling.
INSERT INTO "ClientCompany" ("id", "companyId", "name", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "companyId", "name", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
    SELECT "companyId", btrim("account") AS "name"
    FROM "Contact"
    WHERE "account" IS NOT NULL AND btrim("account") <> ''
    UNION
    SELECT "companyId", btrim("companyName") AS "name"
    FROM "Lead"
    WHERE "companyName" IS NOT NULL AND btrim("companyName") <> ''
) AS typed
GROUP BY "companyId", "name";

-- Point the contacts and the leads at them, matching the way the app does:
-- ignoring surrounding space and capitalisation, and never across companies.
UPDATE "Contact" c
SET "clientCompanyId" = cc."id"
FROM "ClientCompany" cc
WHERE cc."companyId" = c."companyId"
  AND lower(cc."name") = lower(btrim(c."account"))
  AND c."account" IS NOT NULL AND btrim(c."account") <> '';

UPDATE "Lead" l
SET "clientCompanyId" = cc."id"
FROM "ClientCompany" cc
WHERE cc."companyId" = l."companyId"
  AND lower(cc."name") = lower(btrim(l."companyName"))
  AND l."companyName" IS NOT NULL AND btrim(l."companyName") <> '';

-- CreateIndex
CREATE INDEX "Contact_clientCompanyId_idx" ON "Contact"("clientCompanyId");

-- AddForeignKey
ALTER TABLE "ClientCompany" ADD CONSTRAINT "ClientCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "ClientCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "ClientCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Only now: the text it replaced.
ALTER TABLE "Contact" DROP COLUMN "account";
