/**
 * Promueve la empresa de prueba `plasterpro-test` a la identidad real de
 * producción, reusando los datos ya migrados de Quotient en vez de volver a
 * importarlos — ver la sección "Plan de datos para la base de Producción"
 * del plan de despliegue para el porqué.
 *
 * Corre una sola vez contra el branch de Neon `production` (nunca contra la
 * base compartida de dev/preview). Dry-run por defecto; agregar --yes para
 * ejecutar.
 *
 * Usage:
 *   DATABASE_URL_UNPOOLED=<direct conn string del branch production> \
 *     npx tsx scripts/promote-plasterpro-to-production.ts [--yes]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { RoleKey, MembershipStatus } from "../src/generated/prisma/enums";
import { loadSummaryRows } from "./lib/quotient-data";

const TARGET_SLUG = "plasterpro-test";
const NEW_SLUG = "plasterprosolution";
const NEW_NAME = "PlasterPro Solution™";

const OLD_OWNER_EMAIL = "rolando+plasterprotest@plasterprosolution.co.nz";
const NEW_OWNER_EMAIL = "rolando@plasterprosolution.co.nz";

// Misma grafía en las dos constantes (k minúscula en "O'keefe") — así la
// pidió el usuario, y coincide con cómo la exporta el CSV de Quotient.
// Se mantienen separadas porque cumplen roles distintos: FROM_NAME es la
// llave de matching contra el CSV, NAME es lo que se guarda en el User.
const REGAN_FROM_NAME = "Regan O'keefe";
const REGAN_EMAIL = "sales@plasterprosolution.co.nz";
const REGAN_NAME = "Regan O'keefe";

const PATRICIO_EMAIL = "pato.anabalon@gmail.com";
const PATRICIO_NAME = "Patricio Anabalón";

const DRY_RUN = !process.argv.includes("--yes");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL }),
});

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN (pasá --yes para ejecutar) ===" : "=== EJECUTANDO ===");

  const target = await prisma.company.findUnique({
    where: { slug: TARGET_SLUG },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { quotes: true, leads: true, memberships: true, contacts: true } },
    },
  });
  if (!target) {
    console.error(`No existe ninguna empresa con slug "${TARGET_SLUG}" — ¿es el branch correcto?`);
    process.exit(1);
  }
  console.log(
    `Empresa objetivo: ${TARGET_SLUG} (${target.name}) — creada ${target.createdAt.toISOString().slice(0, 10)} — ` +
      `${target._count.quotes} quotes, ${target._count.leads} leads, ${target._count.contacts} contactos, ${target._count.memberships} miembros`,
  );

  const otherCompanies = await prisma.company.findMany({
    where: { slug: { not: TARGET_SLUG } },
    select: {
      slug: true,
      name: true,
      createdAt: true,
      _count: { select: { quotes: true, leads: true, memberships: true, contacts: true } },
    },
  });
  console.log(`Empresas a borrar (${otherCompanies.length}):`);
  for (const c of otherCompanies) {
    console.log(
      `  - ${c.slug} (${c.name}) — creada ${c.createdAt.toISOString().slice(0, 10)} — ` +
        `${c._count.quotes} quotes, ${c._count.leads} leads, ${c._count.contacts} contactos, ${c._count.memberships} miembros`,
    );
  }

  const rows = loadSummaryRows();
  const reganNumbers = rows.filter((r) => r.fromName === REGAN_FROM_NAME).map((r) => r.quoteNumber);
  const otherNumbers = rows.filter((r) => r.fromName !== REGAN_FROM_NAME).map((r) => r.quoteNumber);
  console.log(`Quotes a reasignar a Regan: ${reganNumbers.length}`);
  console.log(`Quotes a reasignar a Rolando: ${otherNumbers.length}`);

  if (DRY_RUN) {
    console.log("\nNada se modificó. Correr de nuevo con --yes para ejecutar.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    const deleted = await tx.company.deleteMany({ where: { slug: { not: TARGET_SLUG } } });
    console.log(`✓ ${deleted.count} empresa(s) borrada(s)`);

    const company = await tx.company.update({
      where: { slug: TARGET_SLUG },
      data: { slug: NEW_SLUG, name: NEW_NAME },
    });
    console.log(`✓ Empresa renombrada a "${company.name}" (${company.slug})`);

    // `rolando@plasterprosolution.co.nz` ya puede existir como User — por
    // ejemplo si era el owner de una de las empresas de prueba recién
    // borradas (el `deleteMany` de arriba borra la Membership en cascada,
    // pero no el User). Si quedó huérfano (sin memberships en ningún lado),
    // es seguro borrarlo antes de renombrar: Account/Session de ese User
    // también cascadean, así que no deja nada colgando.
    const stray = await tx.user.findUnique({
      where: { email: NEW_OWNER_EMAIL },
      select: { id: true, _count: { select: { memberships: true } } },
    });
    if (stray) {
      if (stray._count.memberships > 0) {
        throw new Error(
          `"${NEW_OWNER_EMAIL}" ya existe y todavía tiene ${stray._count.memberships} membership(s) activa(s) ` +
            "— no es un huérfano seguro de borrar, revisar a mano antes de seguir.",
        );
      }
      await tx.user.delete({ where: { id: stray.id } });
      console.log(`✓ Usuario huérfano "${NEW_OWNER_EMAIL}" (sin membership) borrado antes de renombrar`);
    }

    const owner = await tx.user.update({
      where: { email: OLD_OWNER_EMAIL },
      data: { email: NEW_OWNER_EMAIL },
    });
    console.log(`✓ Owner reasignado a ${owner.email}`);

    const [managerRole, adminRole] = await Promise.all([
      tx.role.findFirstOrThrow({ where: { companyId: company.id, key: RoleKey.MANAGER } }),
      tx.role.findFirstOrThrow({ where: { companyId: company.id, key: RoleKey.ADMIN } }),
    ]);

    async function ensureUser(email: string, name: string, roleId: string) {
      const existing = await tx.user.findUnique({ where: { email } });
      const user = existing ?? (await tx.user.create({ data: { email, name } }));
      const membership = await tx.membership.findFirst({ where: { userId: user.id, companyId: company.id } });
      if (!membership) {
        await tx.membership.create({
          data: { userId: user.id, companyId: company.id, roleId, status: MembershipStatus.ACTIVE },
        });
      }
      return user;
    }

    const regan = await ensureUser(REGAN_EMAIL, REGAN_NAME, managerRole.id);
    console.log(`✓ Regan: ${regan.email} (MANAGER)`);
    const patricio = await ensureUser(PATRICIO_EMAIL, PATRICIO_NAME, adminRole.id);
    console.log(`✓ Patricio: ${patricio.email} (ADMIN)`);

    const reganUpdate = await tx.quote.updateMany({
      where: { companyId: company.id, legacyQuotientNumber: { in: reganNumbers } },
      data: { createdById: regan.id },
    });
    console.log(`✓ ${reganUpdate.count} quote(s) asignadas a Regan`);

    const rolandoUpdate = await tx.quote.updateMany({
      where: { companyId: company.id, legacyQuotientNumber: { in: otherNumbers } },
      data: { createdById: owner.id },
    });
    console.log(`✓ ${rolandoUpdate.count} quote(s) asignadas a Rolando`);
  });

  console.log("\nListo. Siguiente paso: scripts/clean-orphaned-quote-blobs.ts");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
