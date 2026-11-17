import { Parser } from "htmlparser2";

/**
 * Escapes text for embedding in HTML.
 *
 * Emails are built by concatenating strings, so anything coming from the
 * database — customer names, notes, line descriptions — has to pass through here
 * before entering the template.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The text a mail client shows when it isn't drawing HTML — and, as much to the
 * point, what a spam filter reads to check the two halves say the same thing.
 *
 * Walks the markup rather than stripping tags with a pattern: paragraphs and
 * list items become lines, and a link keeps its address, because a button
 * drawn as an anchor is the only way to the quote and "View quote" alone
 * would leave the plain version with nowhere to go.
 */
export function htmlToText(html: string): string {
  let out = "";
  let href: string | null = null;
  let linkText = "";

  const parser = new Parser(
    {
      onopentag(name, attributes) {
        if (name === "a") {
          href = attributes.href ?? null;
          linkText = "";
        } else if (name === "li") {
          out += "\n- ";
        } else if (name === "br") {
          out += "\n";
        } else if (/^(p|div|ul|ol|h[1-6]|tr)$/.test(name)) {
          out += "\n\n";
        }
      },
      ontext(text) {
        out += text;
        if (href !== null) linkText += text;
      },
      onclosetag(name) {
        if (name !== "a") return;
        if (href && !linkText.includes(href)) out += ` (${href})`;
        href = null;
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();

  return out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
