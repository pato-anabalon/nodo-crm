-- CreateEnum
CREATE TYPE "ReviewSource" AS ENUM ('GOOGLE', 'NOCOWBOYS', 'FACEBOOK', 'OTHER');


-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quoteExclusions" TEXT,
ADD COLUMN     "quoteIntro" TEXT,
ADD COLUMN     "quoteNotes" TEXT;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "clientCompanyName" TEXT,
ADD COLUMN     "clientEmail" TEXT,
ADD COLUMN     "clientName" TEXT,
ADD COLUMN     "clientPhone" TEXT,
ADD COLUMN     "exclusions" TEXT,
ADD COLUMN     "intro" TEXT,
ADD COLUMN     "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "QuoteSection" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "QuoteSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteAttachment" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'application/pdf',
    "size" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyReview" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "source" "ReviewSource" NOT NULL DEFAULT 'OTHER',
    "sourceUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "featured" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteSection_quoteId_position_idx" ON "QuoteSection"("quoteId", "position");

-- CreateIndex
CREATE INDEX "QuoteAttachment_quoteId_position_idx" ON "QuoteAttachment"("quoteId", "position");

-- CreateIndex
CREATE INDEX "CompanyReview_companyId_featured_position_idx" ON "CompanyReview"("companyId", "featured", "position");

-- AddForeignKey
ALTER TABLE "QuoteSection" ADD CONSTRAINT "QuoteSection_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAttachment" ADD CONSTRAINT "QuoteAttachment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyReview" ADD CONSTRAINT "CompanyReview_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Traspaso de datos
--
-- El orden importa: primero se crean las tablas nuevas, después se copian los
-- datos que viven en columnas que van a desaparecer, y solo al final se cambia
-- el enum. Al revés, el ALTER TYPE fallaría al toparse con 'LUMP_SUM'.
-- ---------------------------------------------------------------------------

-- Cada cotización de precio único se convierte en una de una sola sección: es el
-- mismo documento expresado con el modelo nuevo.
INSERT INTO "QuoteSection" ("id", "quoteId", "position", "title", "body", "amount")
SELECT
  'sec_' || substr(md5(random()::text || "id"), 1, 21),
  "id",
  0,
  "title",
  "summary",
  COALESCE("lumpSumAmount", "subtotal")
FROM "Quote"
WHERE "pricingMode"::text = 'LUMP_SUM';

-- Los datos del cliente se congelan en las cotizaciones ya emitidas, para que
-- dejen de leerse en vivo desde el lead.
UPDATE "Quote" q
SET "clientName" = l."contactName",
    "clientEmail" = l."contactEmail",
    "clientPhone" = l."contactPhone",
    "clientCompanyName" = l."companyName"
FROM "Lead" l
WHERE q."leadId" = l."id" AND q."clientName" IS NULL;

-- Ahora sí, el enum: el USING traduce el valor que desaparece.
BEGIN;
CREATE TYPE "PricingMode_new" AS ENUM ('ITEMIZED', 'SECTIONS');
ALTER TABLE "public"."Quote" ALTER COLUMN "pricingMode" DROP DEFAULT;
ALTER TABLE "Quote" ALTER COLUMN "pricingMode" TYPE "PricingMode_new"
  USING (
    CASE WHEN "pricingMode"::text = 'LUMP_SUM' THEN 'SECTIONS'
         ELSE "pricingMode"::text END
  )::"PricingMode_new";
ALTER TYPE "PricingMode" RENAME TO "PricingMode_old";
ALTER TYPE "PricingMode_new" RENAME TO "PricingMode";
DROP TYPE "public"."PricingMode_old";
ALTER TABLE "Quote" ALTER COLUMN "pricingMode" SET DEFAULT 'ITEMIZED';
COMMIT;

-- Recién acá se pueden soltar las columnas que ya se copiaron.
ALTER TABLE "Quote" DROP COLUMN "lumpSumAmount", DROP COLUMN "summary";
