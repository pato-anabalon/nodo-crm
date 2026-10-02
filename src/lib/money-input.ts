/**
 * Keeps only digits and a single decimal point, as someone types into a
 * currency field.
 *
 * Everything else — letters, a pasted currency symbol or thousands
 * separator, a second decimal point — is dropped rather than rejected
 * outright, so pasting `$1,234.50` still lands as `1234.50` instead of
 * refusing the paste.
 */
export function sanitizeNumericInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const [intPart, ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${intPart}.${rest.join("")}` : intPart;
}
