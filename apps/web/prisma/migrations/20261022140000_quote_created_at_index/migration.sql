-- The quote export reads one calendar year of a company's quotes by `createdAt`.
CREATE INDEX "Quote_companyId_createdAt_idx" ON "Quote"("companyId", "createdAt");
