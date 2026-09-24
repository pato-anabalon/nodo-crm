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
