import type { CompanyContext } from "@/lib/auth/session";
import { Prisma } from "@/generated/prisma/client";
import { normaliseEmail, splitPersonName } from "./identity";
import { attachClientCompany } from "@/modules/client-companies/attach";
import type { ContactFilters, ContactFormValues } from "./schemas";

export const CONTACTS_PAGE_SIZE = 20;

function buildWhere(filters: ContactFilters): Prisma.ContactWhereInput {
  if (!filters.q) return {};
  const q = filters.q;

  return {
    OR: [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      // Now that the phone is on screen, it is something somebody will type
      // into the box that sits above it — a column you can see but not search
      // teaches people the search is unreliable.
      { phone: { contains: q, mode: "insensitive" } },
      { clientCompany: { name: { contains: q, mode: "insensitive" } } },
    ],
  };
}

export async function listContacts(ctx: CompanyContext, filters: ContactFilters) {
  const where = buildWhere(filters);

  const [items, total] = await Promise.all([
    ctx.db.contact.findMany({
      where,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      skip: (filters.page - 1) * CONTACTS_PAGE_SIZE,
      take: CONTACTS_PAGE_SIZE,
      include: {
        clientCompany: { select: { id: true, name: true } },
        _count: { select: { leads: true } },
      },
    }),
    ctx.db.contact.count({ where }),
  ]);

  return {
    items,
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / CONTACTS_PAGE_SIZE)),
  };
}

/**
 * One contact with everything that ever came from them.
 *
 * The leads carry their quotes because that history is the whole point of the
 * record: a person who enquired three times over two years is only visible if
 * the three are shown together.
 */
export async function getContact(ctx: CompanyContext, id: string) {
  return ctx.db.contact.findFirst({
    where: { id },
    include: {
      clientCompany: { select: { id: true, name: true } },
      leads: {
        orderBy: { createdAt: "desc" },
        include: {
          quotes: {
            orderBy: { createdAt: "desc" },
            select: { id: true, number: true, title: true, status: true, total: true, currency: true },
          },
        },
      },
    },
  });
}

/**
 * The company typed into the form, turned into the entity behind it.
 *
 * The field stays a plain text box because that is how the name arrives from
 * everywhere else too; what changes is that the same spelling now lands on the
 * record that already exists.
 */
async function resolveClientCompany(ctx: CompanyContext, name: string | null | undefined) {
  return attachClientCompany(ctx.db, ctx.company.id, name);
}

export async function createContact(ctx: CompanyContext, values: ContactFormValues) {
  const { clientCompanyName, ...rest } = values;

  return ctx.db.contact.create({
    data: {
      companyId: ctx.company.id,
      ...rest,
      // Stored the way it is matched on, so the next enquiry finds this record.
      email: normaliseEmail(values.email),
      clientCompanyId: await resolveClientCompany(ctx, clientCompanyName),
    },
  });
}

export async function updateContact(ctx: CompanyContext, id: string, values: ContactFormValues) {
  const { clientCompanyName, ...rest } = values;

  const { count } = await ctx.db.contact.updateMany({
    where: { id },
    data: {
      ...rest,
      email: normaliseEmail(values.email),
      clientCompanyId: await resolveClientCompany(ctx, clientCompanyName),
    },
  });
  return count > 0;
}

/**
 * Removes the contact without touching what came from them.
 *
 * `Lead.contactId` is `SetNull`, so the leads stay where they are and keep the
 * details they arrived with. Losing the history along with the record would be
 * a surprising thing for a delete button to do.
 */
export async function deleteContact(ctx: CompanyContext, id: string): Promise<boolean> {
  const { count } = await ctx.db.contact.deleteMany({ where: { id } });
  return count > 0;
}

/** Links a lead to a contact, or clears the link when given nothing. */
export async function linkLeadToContact(
  ctx: CompanyContext,
  leadId: string,
  contactId: string | null,
): Promise<boolean> {
  if (contactId) {
    const contact = await ctx.db.contact.findFirst({ where: { id: contactId }, select: { id: true } });
    if (!contact) return false;
  }

  const { count } = await ctx.db.lead.updateMany({ where: { id: leadId }, data: { contactId } });
  return count > 0;
}

/** Contacts matching a lead's own details, to offer before creating another. */
export async function suggestContactsForLead(
  ctx: CompanyContext,
  lead: { contactEmail: string | null; contactName: string | null },
) {
  const email = normaliseEmail(lead.contactEmail);
  const { firstName } = splitPersonName(lead.contactName ?? "");

  if (!email && !firstName) return [];

  return ctx.db.contact.findMany({
    where: {
      OR: [
        ...(email ? [{ email }] : []),
        ...(firstName ? [{ firstName: { contains: firstName, mode: "insensitive" as const } }] : []),
      ],
    },
    take: 5,
    orderBy: { createdAt: "desc" },
  });
}
