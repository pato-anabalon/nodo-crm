import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";

/** Every node that names an argument, as opposed to one that holds text. */
function isArgument(node: MessageFormatElement): boolean {
  return (
    node.type === TYPE.argument ||
    node.type === TYPE.number ||
    node.type === TYPE.date ||
    node.type === TYPE.time ||
    node.type === TYPE.select ||
    node.type === TYPE.plural
  );
}
import { LOCALES } from "../config";
import { MESSAGES } from "@/test/intl";

/** Aplana `{a:{b:"x"}}` en `["a.b"]`. */
function flatten(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("message catalogues", () => {
  it("has a file for every declared language", () => {
    for (const locale of LOCALES) {
      expect(MESSAGES[locale]).toBeDefined();
    }
  });

  it("every language has exactly the same keys", () => {
    const [reference, ...rest] = LOCALES;
    const referenceKeys = flatten(MESSAGES[reference]).sort();

    for (const locale of rest) {
      const keys = flatten(MESSAGES[locale]).sort();
      const missing = referenceKeys.filter((k) => !keys.includes(k));
      const extra = keys.filter((k) => !referenceKeys.includes(k));

      expect({ locale, missing, extra }).toEqual({ locale, missing: [], extra: [] });
    }
  });

  it("leaves no text empty", () => {
    for (const locale of LOCALES) {
      const empty = flatten(MESSAGES[locale]).filter((key) => {
        const value = key.split(".").reduce<unknown>(
          (acc, part) => (acc as Record<string, unknown>)?.[part],
          MESSAGES[locale],
        );
        return typeof value !== "string" || value.trim() === "";
      });
      expect({ locale, empty }).toEqual({ locale, empty: [] });
    }
  });

  /**
   * Parsed with the real ICU parser rather than matched with a regex.
   *
   * A regex cannot tell an argument from the *branches* of a plural or a select
   * — and the branches are translated text, so they are supposed to differ. A
   * `{decision, select, accepted {accepted} …}` in English against
   * `{… accepted {aceptada} …}` in Spanish takes the same one argument and
   * reads differently, which is the entire point.
   *
   * Parsing also rejects what a regex would wave through. A message holding
   * `{{customer}}` is a `MALFORMED_ARGUMENT` that throws when the page renders,
   * not when it is written; that shipped once and reached a real inbox.
   */
  it("takes the same arguments in every language, and parses at all", () => {
    const placeholders = (text: string) => {
      const names = new Set<string>();
      const walk = (nodes: MessageFormatElement[]) => {
        for (const node of nodes) {
          if ("value" in node && typeof node.value === "string" && "type" in node && isArgument(node)) {
            names.add(node.value);
          }
          if ("options" in node && node.options) {
            for (const option of Object.values(node.options) as Array<{ value: MessageFormatElement[] }>) {
              walk(option.value);
            }
          }
          if ("children" in node && node.children) walk(node.children as MessageFormatElement[]);
        }
      };
      walk(parse(text));
      return [...names].sort();
    };

    const [reference, ...rest] = LOCALES;
    for (const key of flatten(MESSAGES[reference])) {
      const read = (locale: (typeof LOCALES)[number]) =>
        key.split(".").reduce<unknown>(
          (acc, part) => (acc as Record<string, unknown>)?.[part],
          MESSAGES[locale],
        ) as string;

      const expected = placeholders(read(reference));
      for (const locale of rest) {
        expect({ key, locale, placeholders: placeholders(read(locale)) }).toEqual({
          key,
          locale,
          placeholders: expected,
        });
      }
    }
  });

  it("covers every permission in the catalogue", async () => {
    const { PERMISSIONS, permissionMessageKey } = await import("@/lib/auth/permissions");
    for (const locale of LOCALES) {
      const messages = MESSAGES[locale] as { permissions: Record<string, string> };
      for (const permission of PERMISSIONS) {
        expect(messages.permissions[permissionMessageKey(permission)]).toBeTruthy();
      }
    }
  });

  it("covers every standard profile", async () => {
    const { ROLE_TEMPLATES } = await import("@/lib/auth/role-templates");
    for (const locale of LOCALES) {
      const messages = MESSAGES[locale] as {
        roles: Record<string, { name: string; description: string }>;
      };
      for (const template of ROLE_TEMPLATES) {
        expect(messages.roles[template.key]?.name).toBeTruthy();
        expect(messages.roles[template.key]?.description).toBeTruthy();
      }
    }
  });

  it("covers every lead and quote status", async () => {
    const { LeadStatus, LeadSource, QuoteStatus, TaxType } = await import(
      "@/generated/prisma/enums"
    );

    for (const locale of LOCALES) {
      const m = MESSAGES[locale] as {
        leads: { status: Record<string, string>; source: Record<string, string> };
        quotes: { status: Record<string, string>; taxType: Record<string, string> };
      };
      for (const status of Object.values(LeadStatus)) expect(m.leads.status[status]).toBeTruthy();
      for (const source of Object.values(LeadSource)) expect(m.leads.source[source]).toBeTruthy();
      for (const status of Object.values(QuoteStatus)) expect(m.quotes.status[status]).toBeTruthy();
      for (const tax of Object.values(TaxType)) expect(m.quotes.taxType[tax]).toBeTruthy();
    }
  });
});
