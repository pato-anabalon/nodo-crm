import { escapeHtml } from "@/lib/html";

export type CustomerEmailData = {
  /** The company's words, already resolved and sanitised. */
  bodyHtml: string;
  primaryColor: string;
  companyName: string;
  /**
   * Shown above the brand rule. Absent for a company that has uploaded none —
   * the initials `CompanyLogo` falls back to are a rendered box, and an email
   * client is not a place to reproduce one.
   */
  logoUrl: string | null;
  /** Under the button. Plain text, so it is escaped here. */
  slogan: string | null;
  /** "Valid until 18 October 2026", already written out. */
  validUntilLabel: string | null;
  /**
    * The button, when there is somewhere useful to send them.
    *
    * The acceptance email has none: the only customer-facing URL is the share
    * token, which cannot be read back from its hash, and the team's own route
    * would land them on a login screen. They pressed accept a second ago — a
    * button that goes nowhere useful is worse than no button.
    */
  cta: { label: string; url: string } | null;
  /** Shared by every email the company sends. Rich text, already sanitised. */
  footerHtml: string | null;
};

/**
 * The email the customer gets when a quote goes out.
 *
 * **It carries no prices and no line items**, and that is the point rather than
 * an omission. The old version embedded a copy of the figures frozen at send
 * time, so editing a quote and sending again left two emails in the customer's
 * inbox showing different totals with nothing to say which was current. Here the
 * link is the only source and it is never stale. It also keeps commercial
 * figures out of something that gets forwarded in one click — a link can at
 * least be revoked.
 *
 * Everything below the button is a field rather than something anyone writes,
 * so the parts that must be right cannot be edited away.
 */
export function renderCustomerEmail(data: CustomerEmailData): string {
  const slogan = data.slogan?.trim()
    ? `<p style="margin:20px 0 4px;font-size:14px;font-style:italic;color:#475569">${escapeHtml(data.slogan)}</p>`
    : "";

  const validUntil = data.validUntilLabel
    ? `<p style="margin:12px 0 0;font-size:13px;color:#64748b">${escapeHtml(data.validUntilLabel)}</p>`
    : "";

  const button = data.cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(data.cta.url)}" style="display:inline-block;background:${escapeHtml(data.primaryColor)};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:15px;font-weight:600">${escapeHtml(data.cta.label)}</a></p>`
    : "";

  /*
   * Centred above the brand rule, and sized in two places on purpose: the
   * `width` attribute is what Outlook reads, the inline `width` is what
   * everything else reads, and `height:auto` keeps the proportions when either
   * of them wins. `max-width:100%` is for the narrow phone.
   */
  const logo = data.logoUrl
    ? `<div style="text-align:center;padding-bottom:20px"><img src="${escapeHtml(data.logoUrl)}" alt="${escapeHtml(data.companyName)}" width="140" style="width:140px;max-width:100%;height:auto;border:0;outline:none;display:inline-block"></div>`
    : "";

  const footer = data.footerHtml
    ? `<div style="margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#64748b">${data.footerHtml}</div>`
    : "";

  return `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#0f172a">
  ${logo}
  <div style="border-top:4px solid ${escapeHtml(data.primaryColor)};padding-top:24px">
    <div style="font-size:14px;line-height:1.6">${data.bodyHtml}</div>

    ${button}
    ${slogan}
    <p style="margin:0;font-size:14px;font-weight:600">${escapeHtml(data.companyName)}</p>
    ${validUntil}
    ${footer}
  </div>
</div>`;
}
