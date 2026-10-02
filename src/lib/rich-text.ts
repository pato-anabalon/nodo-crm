import sanitizeHtml from "sanitize-html";

/**
 * Sanitising the formatted text a company writes.
 *
 * That content ends up on the page the customer opens and in the email they
 * receive, so it goes through here **both when saving and when rendering**.
 * Sanitising in the browser alone is worthless: the request can be forged by
 * hand.
 *
 * The tag set is deliberately short. It isn't a technical limitation but a
 * decision: an email with tables, colours or embedded images renders broken in
 * half the clients out there, and a quote needs none of that.
 */
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "a",
  "h3",
  "blockquote",
] as const;

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...ALLOWED_TAGS],
  allowedAttributes: {
    // `target` and `rel` must be allowed, or sanitising strips them right after
    // `transformTags` adds them.
    a: ["href", "title", "target", "rel"],
  },
  // Only links a customer can actually open: no `javascript:` or `data:`.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href"],
  transformTags: {
    // A link in an email or on the portal opens elsewhere, and `noopener` keeps
    // the destination page from reaching back into ours.
    a: sanitizeHtml.simpleTransform("a", {
      target: "_blank",
      rel: "noopener noreferrer nofollow",
    }),
  },
  // Loose text left outside an allowed tag is kept.
  disallowedTagsMode: "discard",
};

export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(toRichTextHtml(html), OPTIONS).trim();
}

/**
 * Either already-HTML content from the editor, or legacy plain text saved
 * before it existed — turned into HTML either way.
 *
 * Tiptap always wraps even a single line in a block tag, so a value that
 * doesn't start with one is text from before the field was a rich editor:
 * the introduction, notes, exclusions and terms all started as a plain
 * `<textarea>`, and whatever a company had already written has to keep
 * reading the same way — as paragraphs and line breaks, not one run-on line.
 */
export function toRichTextHtml(value: string | null | undefined): string {
  if (!value) return "";
  return /^\s*</.test(value) ? value : plainTextToHtml(value);
}

/** Does it hold real content, or just the empty tags the editor leaves behind? */
export function isRichTextEmpty(html: string | null | undefined): boolean {
  if (!html) return true;
  const text = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return text === "";
}

/**
 * Turns plain text into its HTML equivalent.
 *
 * Used by the migration of content written before the editor existed: a blank
 * line separates paragraphs and a single break becomes a `<br>`, which is how
 * `whitespace-pre-wrap` used to read it.
 */
export function plainTextToHtml(text: string | null | undefined): string {
  if (!text?.trim()) return "";

  return text
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => {
      const lines = paragraph.split("\n").map(escapeText).join("<br>");
      return `<p>${lines}</p>`;
    })
    .join("");
}

/**
 * Plain text out of the HTML, for an email subject or a summary.
 * Lists keep their bullet so they still read as lists.
 */
export function richTextToPlain(html: string | null | undefined): string {
  if (!html) return "";

  return html
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|h3|blockquote)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
