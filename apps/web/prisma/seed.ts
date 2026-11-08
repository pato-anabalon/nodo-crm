/**
 * Seeds the permission catalogue and a demo company.
 * Idempotent: it can be run as many times as needed.
 *
 * It uses relative paths because it runs outside Next's bundler.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { Language, LeadSource, LeadStatus, QuoteStatus, TaxType } from "../src/generated/prisma/enums";
import { syncPermissions, createCompanyWithOwner } from "../src/lib/tenant/provision";
import { calculateQuoteTotals } from "../src/modules/quotes/totals";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const total = await syncPermissions(prisma);
  console.log(`✓ ${total} permissions synced`);

  const demoEmail = "demo@nodo-crm.test";
  const owner = await prisma.user.upsert({
    where: { email: demoEmail },
    create: {
      email: demoEmail,
      name: "Demo Owner",
      language: Language.EN_GB,
      emailVerified: new Date(),
      passwordHash: await bcrypt.hash("demo1234", 10),
    },
    update: {},
  });

  const existing = await prisma.company.findUnique({ where: { slug: "acme" } });
  if (existing) {
    console.log("✓ Demo company `acme` already exists, leaving it alone");
    return;
  }

  const company = await createCompanyWithOwner(prisma, {
    name: "Acme Ltd",
    slug: "acme",
    ownerUserId: owner.id,
  });
  console.log(`✓ Demo company created: ${company.slug}`);

  const lead = await prisma.lead.create({
    data: {
      companyId: company.id,
      title: "Office network installation",
      description: "Quote requested for 3 branches.",
      status: LeadStatus.QUALIFIED,
      source: LeadSource.WEB,
      score: 70,
      estimatedValue: "45000",
      contactName: "Paula Rivas",
      contactEmail: "paula@customer.test",
      contactPhone: "+64 21 123 4567",
      companyName: "Customer Ltd",
      ownerId: owner.id,
    },
  });

  const items = [
    { description: "24-port managed switch", quantity: 3, unitPrice: 4500, discount: 0 },
    { description: "Installation and configuration", quantity: 1, unitPrice: 9000, discount: 10 },
  ];
  // New Zealand GST: 15%.
  const totals = calculateQuoteTotals({ items, taxRate: 15, discount: 0 });

  await prisma.quote.create({
    data: {
      companyId: company.id,
      number: 1,
      leadId: lead.id,
      createdById: owner.id,
      title: "Office network quote",
      status: QuoteStatus.DRAFT,
      language: Language.EN_GB,
      taxType: TaxType.GST,
      taxRate: "15",
      discount: "0",
      subtotal: String(totals.subtotal),
      taxAmount: String(totals.taxAmount),
      total: String(totals.total),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      items: {
        create: items.map((item, index) => ({
          position: index,
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          discount: String(item.discount),
          total: String(totals.lineTotals[index]),
        })),
      },
    },
  });

  console.log("✓ Sample lead and quote created");
  console.log(`\n  Sign in at http://acme.localhost:3100  ·  ${demoEmail} / demo1234\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
