import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { EmailTemplateKind, SenderNameStyle } from "@/generated/prisma/enums";
import {
  AreaField,
  CheckField,
  FieldRow,
  SelectField,
  SettingsForm,
  TextField,
} from "@/modules/settings/settings-form";
import { ReviewLinks } from "@/modules/email-templates/review-links";
import { can } from "@/lib/auth/session";
import { saveEmailSettingsAction } from "@/modules/email-templates/actions";
import { EmailTemplateForm } from "@/modules/email-templates/templates-manager";
import { IMPLEMENTED_KINDS, isOptional, isEnabled, TEMPLATE_ORDER } from "@/modules/email-templates/kinds";
import { templatesFor } from "@/modules/email-templates/service";
import { senderName } from "@/modules/email-templates/sender";
import { SettingsHeader } from "@/modules/settings/settings-header";

export async function generateMetadata() {
  const t = await getTranslations("emailTemplates");
  return { title: t("title") };
}

export default async function EmailSettingsPage() {
  const ctx = await requirePermission("settings.read");
  const [t, tEmail] = await Promise.all([
    getTranslations("emailTemplates"),
    getTranslations("quotes.email"),
  ]);

  const [company, stored, reviewLinks] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: ctx.company.id } }),
    templatesFor(ctx),
    ctx.db.reviewLink.findMany({
      orderBy: { position: "asc" },
      select: { id: true, source: true, url: true },
    }),
  ]);

  // Shown as real examples rather than as enum names: nobody picks "USER_AND_COMPANY",
  // they pick the one that reads like how they answer the phone.
  const senderOptions = Object.values(SenderNameStyle).map((style) => ({
    value: style,
    label: senderName(style, {
      companyName: company.name,
      userName: ctx.user.name,
      connector: tEmail("senderConnector"),
    }),
  }));

  /**
    * The platform's wording, shown as the field's placeholder.
    *
    * Only the kinds that actually send today have one; the rest would be
    * pretending there is a default behind them. The example name is a stand-in
    * because there is no customer here — the point is to show the shape.
    */
  const defaults: Partial<Record<EmailTemplateKind, { subject: string; body: string }>> = {
    [EmailTemplateKind.NEW_QUOTE]: {
      subject: tEmail("defaultSubject"),
      body: tEmail("defaultBody", { customer: t("exampleCustomer") }),
    },
  };

  return (
    <div className="space-y-6">
      <SettingsHeader title={t("title")} subtitle={t("subtitle")} />

      <SettingsForm
        title={t("shared.title")}
        subtitle={t("shared.subtitle")}
        action={saveEmailSettingsAction}
      >
        <>
          <SelectField
            label={t("shared.senderName")}
            name="senderNameStyle"
            defaultValue={company.senderNameStyle}
            options={senderOptions}
            hint={t("shared.senderNameHint")}
          />

          <TextField
            label={t("shared.slogan")}
            name="slogan"
            defaultValue={company.slogan}
            hint={t("shared.sloganHint")}
          />

          <AreaField
            label={t("shared.footer")}
            name="quoteFooter"
            rows={4}
            defaultValue={company.quoteFooter}
            hint={t("shared.footerHint")}
          />

          <FieldRow columns={3}>
            <TextField
              label={t("shared.firstFollowUpDays")}
              name="firstFollowUpDays"
              type="number"
              defaultValue={String(company.firstFollowUpDays)}
            />
            <TextField
              label={t("shared.secondFollowUpDays")}
              name="secondFollowUpDays"
              type="number"
              defaultValue={String(company.secondFollowUpDays)}
            />
            <TextField
              label={t("shared.reviewRequestDays")}
              name="reviewRequestDays"
              type="number"
              defaultValue={String(company.reviewRequestDays)}
            />
          </FieldRow>
          <p className="text-xs text-muted-foreground">{t("shared.daysHint")}</p>

          <CheckField
            label={t("shared.sendCopy")}
            name="sendQuoteCopy"
            defaultChecked={company.sendQuoteCopy}
            hint={t("shared.sendCopyHint", {
              address: company.email?.trim() || ctx.user.email,
            })}
          />
        </>
      </SettingsForm>

      <ReviewLinks links={reviewLinks} canManage={can(ctx, "settings.update")} />

      <div className="space-y-4">
        {TEMPLATE_ORDER.map((kind) => {
          const row = stored.get(kind) ?? null;
          return (
            <EmailTemplateForm
              key={kind}
              card={{
                kind,
                subject: row?.subject ?? null,
                bodyHtml: row?.bodyHtml ?? null,
                enabled: isEnabled(kind, row),
                optional: isOptional(kind),
                live: IMPLEMENTED_KINDS.includes(kind),
                defaultSubject: defaults[kind]?.subject ?? "",
                defaultBody: defaults[kind]?.body ?? "",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}


