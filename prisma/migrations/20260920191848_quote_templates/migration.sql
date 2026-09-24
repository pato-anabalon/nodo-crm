-- CreateTable
CREATE TABLE "QuoteTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "titlePattern" TEXT,
    "pricingMode" "PricingMode" NOT NULL DEFAULT 'ITEMIZED',
    "intro" TEXT,
    "notes" TEXT,
    "terms" TEXT,
    "exclusions" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuoteTemplate_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "QuoteTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    CONSTRAINT "QuoteTemplateItem_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "QuoteTemplateSection" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    CONSTRAINT "QuoteTemplateSection_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "QuoteTemplate_companyId_active_idx" ON "QuoteTemplate"("companyId", "active");
-- CreateIndex
CREATE INDEX "QuoteTemplateItem_templateId_idx" ON "QuoteTemplateItem"("templateId");
-- CreateIndex
CREATE INDEX "QuoteTemplateSection_templateId_idx" ON "QuoteTemplateSection"("templateId");
-- AddForeignKey
ALTER TABLE "QuoteTemplate" ADD CONSTRAINT "QuoteTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "QuoteTemplateItem" ADD CONSTRAINT "QuoteTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "QuoteTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "QuoteTemplateSection" ADD CONSTRAINT "QuoteTemplateSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "QuoteTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
