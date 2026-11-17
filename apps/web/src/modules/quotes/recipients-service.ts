import { prisma } from "@/lib/db/prisma";
import type { CompanyContext } from "@/lib/auth/session";
import type { Prisma } from "@/generated/prisma/client";
import { normaliseEmail } from "@/modules/contacts/identity";
import { isQuoteEditable } from "./constants";
import {
  canRemoveRecipient,
  primaryRecipientFrom,
  recipientName,
  sortRecipients,
  type RecipientDraft,
} from "./recipients";
import { visibilityWhere } from "./service";

type Tx = Prisma.TransactionClient;

export const recipientSelect = {
  id: true,
  name: true,
  email: true,
  isPrimary: true,
  position: true,
  contactId: true,
} satisfies Prisma.QuoteRecipientSelect;

export type QuoteRecipientRow = Prisma.QuoteRecipientGetPayload<{ select: typeof recipientSelect }>;

export type RecipientResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "locked" | "duplicate" | "no-email" | "primary" };

/**
 * Everybody a quote goes to, primary first.
 *
 * Through `prisma` with the quote's id alone, because the sweep and the
 * acceptance confirmation call it with no session; every caller has already
 * established which company the quote belongs to.
 */
export async function recipientsOf(quoteId: string): Promise<QuoteRecipientRow[]> {
  const rows = await prisma.quoteRecipient.findMany({ where: { quoteId }, select: recipientSelect });
  return sortRecipients(rows);
}

/**
 * Makes sure a quote has somebody to send to before a send.
 *
 * A quote made from a lead that had no address yet has no recipient; if the
 * lead has one by the time somebody presses Send, that is who it was always
 * meant for. This is what the send did before recipients existed — it read the
 * lead's address — so nothing that used to send stops sending.
 */
export async function ensurePrimaryRecipient(
  companyId: string,
  quoteId: string,
  lead: { contactName: string | null; contactEmail: string | null; contactId?: string | null } | null,
): Promise<QuoteRecipientRow[]> {
  const existing = await recipientsOf(quoteId);
  if (existing.length > 0) return existing;

  const draft = primaryRecipientFrom(lead);
  if (!draft) return [];

  await prisma.$transaction(async (tx) => {
    await tx.quoteRecipient.create({
      data: { companyId, quoteId, ...draft, isPrimary: true, position: 0 },
    });
    await mirrorPrimary(tx, quoteId, draft);
  });
  return recipientsOf(quoteId);
}

/**
 * Adds somebody to a quote: an existing contact, or an address typed in.
 *
 * A typed address is matched to a contact first, on the email alone — the
 * same rule a web enquiry finds its person by — and a contact is created only
 * when there is none, inheriting the lead's client company. Either way the
 * person ends up in the address book as well as on the quote, which is what
 * Quotient's "add contact" does and what makes them findable next time.
 */
export async function addRecipient(
  ctx: CompanyContext,
  quoteId: string,
  input: { contactId: string } | { firstName: string; lastName: string | null; email: string },
): Promise<RecipientResult> {
  const quote = await ctx.db.quote.findFirst({
    where: { id: quoteId, ...visibilityWhere(ctx) },
    select: {
      id: true,
      status: true,
      lead: { select: { clientCompanyId: true } },
      recipients: { select: { email: true, position: true } },
    },
  });
  if (!quote) return { ok: false, reason: "not-found" };
  if (!isQuoteEditable(quote.status)) return { ok: false, reason: "locked" };

  let draft: RecipientDraft & { phone: string | null };

  if ("contactId" in input) {
    const contact = await ctx.db.contact.findFirst({
      where: { id: input.contactId },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    });
    if (!contact) return { ok: false, reason: "not-found" };
    const email = normaliseEmail(contact.email);
    if (!email) return { ok: false, reason: "no-email" };
    draft = {
      name: recipientName(contact.firstName, contact.lastName),
      email,
      contactId: contact.id,
      phone: contact.phone,
    };
  } else {
    const email = normaliseEmail(input.email);
    if (!email) return { ok: false, reason: "no-email" };

    const known = await ctx.db.contact.findFirst({
      where: { email },
      select: { id: true, firstName: true, lastName: true, phone: true },
    });
    const contact =
      known ??
      (await ctx.db.contact.create({
        data: {
          companyId: ctx.company.id,
          firstName: input.firstName.trim(),
          lastName: input.lastName?.trim() || null,
          email,
          clientCompanyId: quote.lead?.clientCompanyId ?? null,
        },
        select: { id: true, firstName: true, lastName: true, phone: true },
      }));
    draft = {
      name: recipientName(contact.firstName, contact.lastName),
      email,
      contactId: contact.id,
      phone: contact.phone,
    };
  }

  if (quote.recipients.some((recipient) => recipient.email === draft.email)) {
    return { ok: false, reason: "duplicate" };
  }

  // The first person on a quote with nobody yet is its "For", not a copy of
  // nothing.
  const isPrimary = quote.recipients.length === 0;
  const position = Math.max(-1, ...quote.recipients.map((recipient) => recipient.position)) + 1;
  const { phone, ...data } = draft;

  await prisma.$transaction(async (tx) => {
    await tx.quoteRecipient.create({
      data: { companyId: ctx.company.id, quoteId, ...data, isPrimary, position },
    });
    if (isPrimary) await mirrorPrimary(tx, quoteId, { ...data, phone });
  });

  return { ok: true };
}

/**
 * Takes a copy off a quote, and closes the link it was sent.
 *
 * Taking somebody off a quote has to mean they can no longer accept it, so
 * every token issued to them is revoked here — only theirs; the others go on
 * working. The revocation is what keeps the door shut, not the row: once the
 * recipient is gone the token's `recipientId` is cleared, and a revoked token
 * stays revoked whoever it pointed at.
 */
export async function removeRecipient(
  ctx: CompanyContext,
  quoteId: string,
  recipientId: string,
): Promise<RecipientResult> {
  const quote = await loadForChange(ctx, quoteId);
  if (!quote) return { ok: false, reason: "not-found" };
  if (!isQuoteEditable(quote.status)) return { ok: false, reason: "locked" };

  const verdict = canRemoveRecipient(quote.recipients, recipientId);
  if (verdict !== "ok") return { ok: false, reason: verdict };

  await prisma.$transaction(async (tx) => {
    await tx.quoteShareToken.updateMany({
      where: { recipientId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.quoteRecipient.delete({ where: { id: recipientId, quoteId } });
  });

  return { ok: true };
}

/**
 * Makes a copy the quote's "For".
 *
 * The quote's own client fields follow it, in the same transaction, because
 * they are what the document, the PDF and every list read.
 */
export async function makePrimaryRecipient(
  ctx: CompanyContext,
  quoteId: string,
  recipientId: string,
): Promise<RecipientResult> {
  const quote = await loadForChange(ctx, quoteId);
  if (!quote) return { ok: false, reason: "not-found" };
  if (!isQuoteEditable(quote.status)) return { ok: false, reason: "locked" };

  // Checked against *this* quote's own rows: `ctx.db` only guards the
  // company, not which quote a row belongs to within it.
  const target = quote.recipients.find((recipient) => recipient.id === recipientId);
  if (!target) return { ok: false, reason: "not-found" };
  if (target.isPrimary) return { ok: true };

  await prisma.$transaction(async (tx) => {
    await promote(tx, quoteId, target.id);
    const phone = target.contactId
      ? ((await tx.contact.findUnique({ where: { id: target.contactId }, select: { phone: true } }))
          ?.phone ?? null)
      : null;
    await mirrorPrimary(tx, quoteId, { name: target.name, email: target.email, phone });
  });

  return { ok: true };
}

/**
 * The quote's lead changed: the primary follows the new lead, the copies stay.
 *
 * Runs inside `updateQuote`'s own transaction, after the client fields were
 * rewritten from the new lead. If the new lead's address is already a copy,
 * that copy is promoted rather than added twice. A lead with no address leaves
 * the first copy as the "For", so a quote with recipients is never without one.
 */
export async function replacePrimaryRecipient(
  tx: Tx,
  companyId: string,
  quoteId: string,
  lead: { contactName: string | null; contactEmail: string | null; contactId?: string | null } | null,
): Promise<void> {
  const current = await tx.quoteRecipient.findFirst({
    where: { quoteId, isPrimary: true },
    select: { id: true },
  });
  if (current) {
    await tx.quoteShareToken.updateMany({
      where: { recipientId: current.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.quoteRecipient.delete({ where: { id: current.id } });
  }

  const draft = primaryRecipientFrom(lead);
  const others = sortRecipients(
    await tx.quoteRecipient.findMany({ where: { quoteId }, select: recipientSelect }),
  );

  if (draft) {
    const already = others.find((recipient) => recipient.email === draft.email);
    if (already) {
      await promote(tx, quoteId, already.id);
    } else {
      await tx.quoteRecipient.create({
        data: { companyId, quoteId, ...draft, isPrimary: true, position: 0 },
      });
    }
    return;
  }

  const first = others[0];
  if (first) {
    await promote(tx, quoteId, first.id);
    await mirrorPrimary(tx, quoteId, { name: first.name, email: first.email, phone: null });
  }
}

async function loadForChange(ctx: CompanyContext, quoteId: string) {
  return ctx.db.quote.findFirst({
    where: { id: quoteId, ...visibilityWhere(ctx) },
    select: { id: true, status: true, recipients: { select: recipientSelect } },
  });
}

/** Cleared before set: the partial unique index allows one primary at any instant. */
async function promote(tx: Tx, quoteId: string, recipientId: string) {
  await tx.quoteRecipient.updateMany({
    where: { quoteId, isPrimary: true },
    data: { isPrimary: false },
  });
  await tx.quoteRecipient.update({ where: { id: recipientId, quoteId }, data: { isPrimary: true } });
}

async function mirrorPrimary(
  tx: Tx,
  quoteId: string,
  primary: { name: string; email: string; phone?: string | null },
) {
  await tx.quote.update({
    where: { id: quoteId },
    data: {
      clientName: primary.name,
      clientEmail: primary.email,
      ...(primary.phone !== undefined ? { clientPhone: primary.phone } : {}),
    },
  });
}
