/**
 * Building the `From` header per RFC 5322.
 *
 * The display name is the company's, and that text is typed by each customer at
 * sign-up: untrusted input. Unescaped, "Acme, Ltd." reads as two addresses, and
 * a name containing `<other@domain>` can inject a foreign sender.
 */

/** Characters that force the name into a quoted string (RFC 5322 §3.2.3). */
const SPECIALS = /[()<>\[\]:;@\\,."]/;

/** Line breaks and control characters: the classic way to inject headers. */
const CONTROL = /[\r\n\t\0]/g;

export function formatDisplayName(name: string): string {
  const clean = name
    .replace(CONTROL, " ")
    // `\r\n` leaves two spaces; collapsing them avoids names with odd gaps.
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 200);
  if (clean === "") return "";

  if (!SPECIALS.test(clean)) return clean;

  // Inside quotes the backslash and the quote itself must be escaped, in that
  // order: the other way round would escape the backslashes just added.
  const escaped = clean.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function formatAddress(name: string, email: string): string {
  const display = formatDisplayName(name);
  return display ? `${display} <${email}>` : email;
}
