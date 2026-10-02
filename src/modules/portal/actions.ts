"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/prisma";
import { translateFieldErrors } from "@/lib/i18n-errors";
import {
  MessageAuthor,
  QuoteEventType,
  QuoteSectionKind,
  QuoteStatus,
  SignatureType,
} from "@/generated/prisma/enums";
import { sendAcceptedEmail } from "@/modules/email-templates/accepted-email";
import { notifyClientMessage, notifyQuoteDecided } from "@/modules/notifications/service";
import { calculateQuoteTotals } from "@/modules/quotes/totals";
import { resolveSelectedSectionAmounts, type SectionSelectionState } from "@/modules/quotes/section-selection";
import { bundleFrom } from "@/modules/quotes/service";
import { acceptQuoteSchema, buildStatement, clientMessageSchema, declineQuoteSchema } from "./schemas";
import { canClientRespond, resolveShare } from "./service";

export type PortalActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  done?: boolean;
};

async function requestMeta() {
  const h = await headers();
  return {
    ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  };
}

/**
 * The customer accepts their quote.
 *
 * Everything backing the acceptance — who they said they were, the text they
 * read, their signature, the IP and the time — is stored together. The text is
 * frozen here: if the company edits it tomorrow, this must not change.
 */
export async function acceptQuoteAction(
  token: string,
  _prev: PortalActionState,
  formData: FormData,
): Promise<PortalActionState> {
  const t = await getTranslations();
  const { status, share } = await resolveShare(token);

  if (status !== "ok" || !share) return { error: t("portal.errors.notAvailable") };
  if (!canClientRespond(share.quote.status)) return { error: t("portal.errors.notAvailable") };

  const company = share.company;

  // The checkbox only exists when the company requires it.
  if (company.acceptanceMode === "STATEMENT_WITH_CHECKBOX" && formData.get("agree") !== "on") {
    return { fieldErrors: { agree: [t("portal.errors.statementRequired")] } };
  }

  const parsed = acceptQuoteSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    signatureType: formData.get("signatureType") || SignatureType.NONE,
    signatureData: formData.get("signatureData"),
    additionalComments: formData.get("additionalComments"),
    orderReference: formData.get("orderReference"),
  });

  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  if (company.requireSignature && !parsed.data.signatureData) {
    return { fieldErrors: { signatureData: [t("portal.errors.signatureRequired")] } };
  }

  const meta = await requestMeta();
  const statementText = buildStatement(
    company.acceptanceStatement,
    parsed.data.name,
    t("portal.defaultStatement"),
  );

  /*
   * The figures freeze here against the customer's *final* choices, not
   * whatever was true when the quote was sent — the same pipeline the
   * creator's form and the server both already run (see `totalsFor` in
   * `quotes/service.ts`), just fed the selection as it actually stood the
   * moment they accepted. For a quote with no selectable sections (every
   * install base before this feature, and most quotes after it too) this
   * reproduces exactly what was already frozen at send time.
   */
  const quote = share.quote;
  const selection: SectionSelectionState = Object.fromEntries(
    quote.sections.map((section) => [section.id, section.customerSelected]),
  );
  const bySections = quote.pricingMode === "SECTIONS";
  const sectionsTotal = bySections
    ? resolveSelectedSectionAmounts(
        quote.sections.map((section) => ({
          id: section.id,
          amount: Number(section.amount),
          discountType: section.discountType,
          discountValue: Number(section.discountValue),
          kind: section.kind,
          selectedByDefault: section.selectedByDefault,
        })),
        selection,
        bundleFrom({
          optionalDiscountThreshold: quote.optionalDiscountThreshold,
          optionalDiscountType: quote.optionalDiscountType,
          optionalDiscountValue:
            quote.optionalDiscountValue === null ? null : Number(quote.optionalDiscountValue),
        }),
      ).sectionsTotal
    : null;
  const totals = calculateQuoteTotals({
    items: bySections
      ? []
      : quote.items.map((item) => ({
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount),
        })),
    sections: sectionsTotal === null ? null : [sectionsTotal],
    taxRate: Number(quote.taxRate),
    discount: Number(quote.discountValue),
    discountType: quote.discountType,
    taxDisplayMode: quote.taxDisplayMode,
  });

  // A quote priced by sections can be accepted with nothing actually
  // selected — every `OPTIONAL` left unticked, no `MULTIPLE_CHOICE` winner —
  // which would freeze a $0 commitment. Checked here, against the figure
  // that's about to be frozen, rather than trusting whatever the client last
  // rendered.
  if (totals.total <= 0) {
    return { error: t("portal.errors.nothingSelected") };
  }

  await prisma.$transaction([
    prisma.quoteAcceptance.create({
      data: {
        companyId: company.id,
        quoteId: share.quoteId,
        acceptedByName: parsed.data.name,
        acceptedByEmail: parsed.data.email ?? null,
        statementText,
        signatureType: parsed.data.signatureType,
        signatureData: parsed.data.signatureData ?? null,
        additionalComments: parsed.data.additionalComments ?? null,
        orderReference: parsed.data.orderReference ?? null,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    }),
    prisma.quote.update({
      where: { id: share.quoteId },
      data: {
        status: QuoteStatus.ACCEPTED,
        decidedAt: new Date(),
        subtotal: totals.subtotal,
        discount: totals.discount,
        taxAmount: totals.taxAmount,
        total: totals.total,
      },
    }),
    prisma.quoteEvent.create({
      data: {
        companyId: company.id,
        quoteId: share.quoteId,
        type: QuoteEventType.ACCEPTED,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    }),
  ]);

  // The notice must not keep the customer waiting in front of the screen.
  after(() => notifyQuoteDecided(share.quoteId, "accepted"));
  // The customer hears back too. Until now accepting produced silence on their
  // side, which for a commercial commitment reads like a form that didn't submit.
  after(() => sendAcceptedEmail(share.quoteId));

  revalidatePath(`/q/${token}`);
  return { done: true };
}

export async function declineQuoteAction(
  token: string,
  _prev: PortalActionState,
  formData: FormData,
): Promise<PortalActionState> {
  const t = await getTranslations();
  const { status, share } = await resolveShare(token);

  if (status !== "ok" || !share) return { error: t("portal.errors.notAvailable") };
  if (!canClientRespond(share.quote.status)) return { error: t("portal.errors.notAvailable") };

  const parsed = declineQuoteSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  const meta = await requestMeta();

  await prisma.$transaction([
    prisma.quote.update({
      where: { id: share.quoteId },
      data: { status: QuoteStatus.REJECTED, decidedAt: new Date() },
    }),
    prisma.quoteEvent.create({
      data: {
        companyId: share.company.id,
        quoteId: share.quoteId,
        type: QuoteEventType.DECLINED,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    }),
  ]);

  // The reason for declining goes into the thread: it's what the team will want to read.
  if (parsed.data.reason) {
    await prisma.quoteMessage.create({
      data: {
        companyId: share.company.id,
        quoteId: share.quoteId,
        author: MessageAuthor.CLIENT,
        body: parsed.data.reason,
      },
    });
  }

  after(() => notifyQuoteDecided(share.quoteId, "declined"));

  revalidatePath(`/q/${token}`);
  return { done: true };
}

export async function sendClientMessageAction(
  token: string,
  _prev: PortalActionState,
  formData: FormData,
): Promise<PortalActionState> {
  const t = await getTranslations();
  const { status, share } = await resolveShare(token);

  if (status !== "ok" || !share) return { error: t("portal.errors.notAvailable") };

  const parsed = clientMessageSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  await prisma.$transaction([
    prisma.quoteMessage.create({
      data: {
        companyId: share.company.id,
        quoteId: share.quoteId,
        author: MessageAuthor.CLIENT,
        body: parsed.data.body,
      },
    }),
    prisma.quoteEvent.create({
      data: {
        companyId: share.company.id,
        quoteId: share.quoteId,
        type: QuoteEventType.MESSAGE_SENT,
      },
    }),
  ]);

  after(() => notifyClientMessage(share.quoteId, parsed.data.body));

  revalidatePath(`/q/${token}`);
  return { done: true };
}

export type SectionSelectionResult = { ok: boolean; error?: string };

/**
 * The customer ticking an optional section, or choosing one of several.
 *
 * Deliberately no `revalidatePath`, unlike every action above: this fires on
 * every click, and a full-page revalidate would throw away the section
 * selector's own optimistic, animated state for something the page already
 * reflects locally. The write is best-effort persistence — so the choice
 * survives a reload or a resumed session — not something the current render
 * is waiting on.
 */
export async function updateSectionSelectionAction(
  token: string,
  sectionId: string,
  selected: boolean,
): Promise<SectionSelectionResult> {
  const { status, share } = await resolveShare(token);
  if (status !== "ok" || !share) return { ok: false, error: "not-available" };
  if (!canClientRespond(share.quote.status)) return { ok: false, error: "not-available" };

  const section = share.quote.sections.find((s) => s.id === sectionId);
  if (!section) return { ok: false, error: "not-found" };

  if (section.kind === QuoteSectionKind.MULTIPLE_CHOICE && selected) {
    // Every other multiple-choice section in the same quote is cleared in the
    // same statement, so two rows can never read `true` at once, even for an
    // instant — the whole point of "one of several choices".
    await prisma.$transaction([
      prisma.quoteSection.updateMany({
        where: { quoteId: share.quoteId, kind: QuoteSectionKind.MULTIPLE_CHOICE },
        data: { customerSelected: false },
      }),
      prisma.quoteSection.update({
        where: { id: sectionId },
        data: { customerSelected: true },
      }),
    ]);
  } else {
    await prisma.quoteSection.update({
      where: { id: sectionId },
      data: { customerSelected: selected },
    });
  }

  return { ok: true };
}
