import { isRichTextEmpty, plainTextToHtml, sanitizeRichText } from "@/lib/rich-text";
import { applyFields, type EmailFieldValues } from "./fields";

export type StoredTemplate = { subject: string | null; bodyHtml: string | null } | null;

/** The platform's own wording, already in the language the customer reads. */
export type TemplateFallback = { subject: string; body: string };

export type RenderedEmail = { subject: string; bodyHtml: string };

/**
 * Turns what a company saved — or didn't — into the subject and body that go out.
 *
 * **The company's words win, and they win whole.** Not merged with the default,
 * not falling back field by field: a subject typed with an empty body uses the
 * typed subject and the default body, and each of those is a complete thought
 * somebody wrote. Stitching half of one onto half of the other produces an email
 * nobody composed.
 *
 * **Empty means the default**, and the default is translated while a typed text
 * is not. That is the whole rule for language: a company that writes "Hola,
 * adjunto tu cotización" meant it, and sending the English default to one
 * customer and their Spanish to another would be the surprising thing.
 */
export function renderTemplate(input: {
  stored: StoredTemplate;
  fallback: TemplateFallback;
  values: EmailFieldValues;
  /** Appended to the subject, never typed in. */
  reference: string;
}): RenderedEmail {
  const subject = pick(input.stored?.subject, input.fallback.subject);

  const storedBody = isRichTextEmpty(input.stored?.bodyHtml) ? null : input.stored?.bodyHtml;
  // The defaults live in the message files as plain text: they are read and
  // translated by people, and making translators write HTML is how a stray tag
  // ends up in a customer's inbox.
  const bodyHtml = storedBody ?? plainTextToHtml(input.fallback.body);

  return {
    subject: withReference(applyFields(subject, input.values), input.reference),
    // Sanitised again on the way out, not only on the way in: this text leaves
    // the platform for somebody else's inbox, and the save it came through may
    // predate the rules being applied now.
    bodyHtml: sanitizeRichText(applyFields(bodyHtml, input.values)),
  };
}

/**
 * Puts the reference in the subject, once.
 *
 * It is **appended**, not offered as something to remember: it is how a customer
 * tells two of your quotes apart in their inbox and names one on the phone, and
 * that cannot depend on somebody having typed it.
 *
 * But `{{reference}}` is a field, so a company can also place it themselves —
 * and one did, which is how "New Quote: Paula Rivas - COT-000007 [COT-000007]"
 * reached an inbox. Appending only when it isn't already there keeps the default
 * everybody gets without configuring anything, and lets whoever wants it at the
 * front put it there.
 */
function withReference(subject: string, reference: string): string {
  const trimmed = subject.trim();
  return trimmed.includes(reference) ? trimmed : `${trimmed} [${reference}]`;
}

function pick(stored: string | null | undefined, fallback: string): string {
  const trimmed = stored?.trim();
  return trimmed ? trimmed : fallback;
}
