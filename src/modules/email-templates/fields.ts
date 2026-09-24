/**
 * The fields a company can drop into an email it words itself.
 *
 * A closed catalogue, used both to **substitute** when sending and to
 * **validate** when saving. Those being the same list is the point: a
 * `{{custmer}}` has to fail on the screen, in front of the person who typed it,
 * rather than reach a customer as literal braces.
 *
 * The names are English, like the routes. A user working in Spanish sees
 * "Cotizaciones" on screen and `/quotes` in the address bar, and by the same
 * rule they see "Nombre del cliente" beside `{{customer}}`. One vocabulary in
 * the stored text means a template still reads the same after somebody switches
 * their interface language.
 */

export const EMAIL_FIELDS = ["customer", "reference", "company"] as const;

export type EmailField = (typeof EMAIL_FIELDS)[number];

export type EmailFieldValues = Record<EmailField, string>;

/** Matches `{{ name }}` with any spacing, so a stray space isn't an error. */
const TOKEN = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

export function isEmailField(name: string): name is EmailField {
  return (EMAIL_FIELDS as readonly string[]).includes(name);
}

/**
 * Every field mentioned in a text that isn't in the catalogue.
 *
 * Returned rather than thrown, and de-duplicated, because the screen shows them
 * all at once: fixing a typo only to be told about the next one is a bad way to
 * spend somebody's afternoon.
 */
export function unknownFields(text: string): string[] {
  const found = new Set<string>();
  for (const [, name] of text.matchAll(TOKEN)) {
    if (!isEmailField(name)) found.add(name);
  }
  return [...found];
}

/**
 * Replaces the fields with their values.
 *
 * An empty value stays empty rather than becoming a placeholder word: a quote
 * whose contact has no name would otherwise greet them as "there" or
 * "customer", and being addressed by a category reads worse than not being
 * addressed at all.
 *
 * Unknown fields are left exactly as written. They cannot arrive through the
 * form — saving rejects them — so one here means the catalogue shrank after the
 * text was saved, and showing `{{total}}` is the visible failure that gets it
 * noticed. Blanking it would hide the loss inside a sentence that still reads.
 */
export function applyFields(text: string, values: EmailFieldValues): string {
  return text.replace(TOKEN, (whole, name: string) =>
    isEmailField(name) ? values[name] : whole,
  );
}
