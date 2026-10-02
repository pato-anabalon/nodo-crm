import { escapeHtml } from "@/lib/html";

export type QuoteEmailLine = {
  description: string;
  quantity: string;
  total: string;
};

export type QuoteEmailSection = {
  title: string;
  amount: string;
  /** Already-sanitised HTML; the template doesn't escape it again. */
  bodyHtml: string | null;
};

export type QuoteEmailData = {
  companyName: string;
  primaryColor: string;
  contactName: string | null;
  reference: string;
  title: string;
  total: string;
  validUntil: string | null;
  /** Empty on quotes priced by sections. */
  lines: QuoteEmailLine[];
  /** Blocks of work with their price, when quoting by sections. */
  sections: QuoteEmailSection[];
  /** Already-sanitised HTML, same as a section's `bodyHtml`; not escaped again. */
  notesHtml: string | null;
  /** Link to the customer portal. Null when a valid one already existed. */
  viewUrl: string | null;
  labels: {
    greeting: string;
    intro: string;
    itemsHeader: string;
    quantityHeader: string;
    totalHeader: string;
    total: string;
    validUntil: string;
    viewQuote: string;
  };
};

/**
 * HTML for the quote email.
 *
 * A pure function with no Prisma or next-intl dependency: it receives the text
 * already translated into the quote's language and returns the HTML. That way
 * the escaping — which is where the bugs slip in — can be tested directly.
 */
export function renderQuoteEmail(data: QuoteEmailData): string {
  const rows = data.lines
    .map(
      (line) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb">${escapeHtml(line.description)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right">${escapeHtml(line.quantity)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right">${escapeHtml(line.total)}</td>
        </tr>`,
    )
    .join("");

  // Sections carry a description, so they go as blocks rather than table rows:
  // a paragraph inside a cell reads badly in an email.
  const sectionBlocks = data.sections
    .map(
      (section) => `
      <div style="border-top:1px solid #e5e7eb;padding:14px 0">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="font-size:15px;font-weight:600">${escapeHtml(section.title)}</td>
            <td style="font-size:15px;text-align:right;white-space:nowrap">${escapeHtml(section.amount)}</td>
          </tr>
        </table>
        ${section.bodyHtml ? `<div style="font-size:13px;color:#475569;margin-top:6px">${section.bodyHtml}</div>` : ""}
      </div>`,
    )
    .join("");

  const detail = data.lines.length
    ? `
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
      <thead>
        <tr style="text-align:left;color:#64748b;font-size:12px">
          <th style="padding-bottom:8px">${escapeHtml(data.labels.itemsHeader)}</th>
          <th style="padding-bottom:8px;text-align:right">${escapeHtml(data.labels.quantityHeader)}</th>
          <th style="padding-bottom:8px;text-align:right">${escapeHtml(data.labels.totalHeader)}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`
    : data.sections.length
      ? `<div style="margin:16px 0">${sectionBlocks}</div>`
      : "";

  return `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#0f172a">
  <div style="border-top:4px solid ${escapeHtml(data.primaryColor)};padding-top:24px">
    <p style="margin:0 0 4px;font-size:13px;color:#64748b">${escapeHtml(data.companyName)}</p>
    <h1 style="margin:0 0 4px;font-size:20px">${escapeHtml(data.title)}</h1>
    <p style="margin:0 0 24px;font-size:13px;color:#64748b">${escapeHtml(data.reference)}</p>

    ${data.contactName ? `<p style="font-size:14px">${escapeHtml(data.labels.greeting)}</p>` : ""}
    <p style="font-size:14px">${escapeHtml(data.labels.intro)}</p>

    ${detail}

    <p style="font-size:18px;font-weight:600;text-align:right;margin:16px 0">${escapeHtml(data.labels.total)}</p>
    ${
      data.viewUrl
        ? `<p style="margin:24px 0"><a href="${escapeHtml(data.viewUrl)}" style="display:inline-block;background:${escapeHtml(data.primaryColor)};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:15px;font-weight:600">${escapeHtml(data.labels.viewQuote)}</a></p>`
        : ""
    }
    ${data.validUntil ? `<p style="font-size:13px;color:#64748b">${escapeHtml(data.labels.validUntil)}</p>` : ""}
    ${data.notesHtml ? `<div style="font-size:13px;color:#475569">${data.notesHtml}</div>` : ""}
  </div>
</div>`;
}
