import type { CompanyContext } from "@/lib/auth/session";
import { EmailTemplateKind } from "@/generated/prisma/enums";
import type { EmailTemplateValues } from "./schemas";

export type StoredRow = {
  kind: EmailTemplateKind;
  subject: string | null;
  bodyHtml: string | null;
  enabled: boolean;
};

const select = { kind: true, subject: true, bodyHtml: true, enabled: true } as const;

/**
 * What the company has saved, by kind.
 *
 * A kind missing from the map is the ordinary state, not an error: it means the
 * company has said nothing and the platform's own wording applies.
 */
export async function templatesFor(ctx: CompanyContext): Promise<Map<EmailTemplateKind, StoredRow>> {
  const rows = await ctx.db.emailTemplate.findMany({ select });
  return new Map(rows.map((row) => [row.kind, row]));
}

export async function templateFor(
  ctx: CompanyContext,
  kind: EmailTemplateKind,
): Promise<StoredRow | null> {
  return ctx.db.emailTemplate.findFirst({ where: { kind }, select });
}

/**
 * Writes one template.
 *
 * An upsert because a row is created the first time somebody types into it, not
 * at sign-up: seeding five rows per company would mean a company created last
 * year is stuck with last year's default wording.
 */
export async function saveTemplate(ctx: CompanyContext, values: EmailTemplateValues) {
  const data = {
    subject: values.subject ?? null,
    bodyHtml: values.bodyHtml ?? null,
    enabled: values.enabled,
  };

  return ctx.db.emailTemplate.upsert({
    where: { companyId_kind: { companyId: ctx.company.id, kind: values.kind } },
    create: { companyId: ctx.company.id, kind: values.kind, ...data },
    update: data,
    select,
  });
}
