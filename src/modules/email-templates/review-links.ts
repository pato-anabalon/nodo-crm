import { EmailTemplateKind } from "@/generated/prisma/enums";
import type { PlatformLink } from "@/modules/settings/review-platforms";

/**
 * The one field that is not a value. It stands for a list of links, and only
 * the review request has them, so it is accepted in that body and nowhere else.
 */
export const REVIEW_LINKS_FIELD = "reviewLinks";

const TOKEN = new RegExp(`\\{\\{\\s*${REVIEW_LINKS_FIELD}\\s*\\}\\}`);
const TOKEN_ALONE = new RegExp(`<p[^>]*>\\s*${TOKEN.source}\\s*</p>`);

/**
 * The review links, as a list.
 *
 * Where the company puts `{{reviewLinks}}` is where the list goes — above their
 * signature, say. Leave it out and the list is **appended**, never dropped: the
 * whole email exists to hand these over, and one left out by forgetting the
 * field is an email that asks for a favour and then doesn't say where.
 *
 * A field alone in its paragraph replaces the paragraph, since a list inside a
 * `<p>` is invalid and clients each repair it differently.
 */
export function withReviewLinks(
  bodyHtml: string,
  kind: EmailTemplateKind,
  links: PlatformLink[],
): string {
  if (kind !== EmailTemplateKind.REVIEW_REQUEST) return bodyHtml;
  if (links.length === 0) return bodyHtml.replace(TOKEN_ALONE, "").replace(TOKEN, "");

  const items = links
    .map(
      (link) =>
        `<li style="margin:4px 0"><a href="${escapeAttribute(link.url)}">${escapeText(link.name)}</a></li>`,
    )
    .join("");
  const list = `<ul style="padding-left:18px;margin:12px 0">${items}</ul>`;

  if (TOKEN_ALONE.test(bodyHtml)) return bodyHtml.replace(TOKEN_ALONE, () => list);
  if (TOKEN.test(bodyHtml)) return bodyHtml.replace(TOKEN, () => list);
  return `${bodyHtml}${list}`;
}

/** A platform's name can be typed by the company ("Builderscrack"), so it is
 * escaped like any other text going into the HTML. */
function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
