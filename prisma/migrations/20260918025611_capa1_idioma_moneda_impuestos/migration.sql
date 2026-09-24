-- CreateEnum
CREATE TYPE "Language" AS ENUM ('EN_GB', 'ES');

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('GST', 'HST', 'VAT', 'IVA', 'TAX');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "defaultLanguage" "Language" NOT NULL DEFAULT 'EN_GB',
ADD COLUMN     "defaultTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 15,
ADD COLUMN     "defaultTaxType" "TaxType" NOT NULL DEFAULT 'GST',
ALTER COLUMN "currency" SET DEFAULT 'NZD',
ALTER COLUMN "locale" SET DEFAULT 'en-NZ',
ALTER COLUMN "timezone" SET DEFAULT 'Pacific/Auckland';

-- AlterTable
ALTER TABLE "Lead" ALTER COLUMN "currency" SET DEFAULT 'NZD';

-- AlterTable
ALTER TABLE "Permission" DROP COLUMN "description";

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "language" "Language" NOT NULL DEFAULT 'EN_GB',
ADD COLUMN     "taxType" "TaxType" NOT NULL DEFAULT 'GST',
ALTER COLUMN "currency" SET DEFAULT 'NZD',
ALTER COLUMN "taxRate" SET DEFAULT 15;

-- AlterTable
ALTER TABLE "Role" ALTER COLUMN "name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "language" "Language";


-- Los perfiles estándar dejan de guardar su nombre traducido: ahora se traduce
-- desde `key`. Solo conservan texto los que una empresa haya renombrado.
UPDATE "Role" SET "name" = NULL, "description" = NULL WHERE "isSystem" = true;
