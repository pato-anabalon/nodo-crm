import { getLocale, getTranslations } from "next-intl/server";
import { can, requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AcceptanceMode, Language, TaxDisplayMode, TaxType } from "@/generated/prisma/enums";
import { LOCALES, LOCALE_NAMES } from "@/i18n/config";
import {
  currencyOptions,
  formatLocaleOptions,
  timezoneOptions,
} from "@/lib/intl/options";
import {
  AreaField,
  CheckField,
  FieldRow,
  RichAreaField,
  SelectField,
  SettingsForm,
  TextField,
} from "@/modules/settings/settings-form";
import {
  saveAcceptanceSettingsAction,
  saveCompanyProfileAction,
  saveQuoteSettingsAction,
} from "@/modules/settings/actions";
import { LogoManager } from "@/modules/settings/logo-manager";
import { WatermarkManager } from "@/modules/settings/watermark-manager";
import { QuoteTypesManager } from "@/modules/settings/quote-types-manager";
import { SettingsHeader } from "@/modules/settings/settings-header";

export async function generateMetadata() {
  const t = await getTranslations("settings");
  return { title: t("profile.title") };
}

export default async function CompanySettingsPage() {
  const ctx = await requirePermission("settings.read");
  const [t, tQuotes, locale] = await Promise.all([
    getTranslations("settings"),
    getTranslations("quotes"),
    getLocale(),
  ]);

  // Built here rather than in the client form: the names of 162 currencies are
  // a translation the platform already has, and they belong to the language the
  // person is reading in.
  const currencies = currencyOptions(locale);
  const formats = formatLocaleOptions(locale);
  const timezones = timezoneOptions();

  // Read directly: it's the settings of the company in the context itself.
  const company = await prisma.company.findUniqueOrThrow({ where: { id: ctx.company.id } });
  const quoteTypes = await ctx.db.companyQuoteType.findMany({ orderBy: { position: "asc" } });

  return (
    <div className="space-y-6">
      <SettingsHeader title={t("profile.title")} subtitle={t("profile.subtitle")} />

      {/* Side by side: they are the same decision about how the company looks
          to its customer, and each card is narrow enough to share the row. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <LogoManager
          companyName={company.name}
          logoUrl={company.logoUrl}
          canManage={can(ctx, "settings.update")}
        />

        <WatermarkManager
          companyName={company.name}
          watermarkUrl={company.watermarkUrl}
          canManage={can(ctx, "settings.update")}
        />
      </div>

      <SettingsForm
        title={t("profile.title")}
        subtitle={t("profile.subtitle")}
        action={saveCompanyProfileAction}
      >
        <>
            <FieldRow>
              <TextField label={t("profile.name")} name="name" required
                defaultValue={company.name} />
              <TextField label={t("profile.legalName")} name="legalName"
                defaultValue={company.legalName} />
              <TextField label={t("profile.taxId")} name="taxId"
                defaultValue={company.taxId} placeholder="145-448-867" />
              <TextField label={t("profile.email")} name="email" type="email"
                defaultValue={company.email} />
            </FieldRow>

            <TextField label={t("profile.phone")} name="phone" hint={t("profile.phoneHint")}
              defaultValue={company.phone} />
            <TextField label={t("profile.website")} name="website"
              defaultValue={company.website} />
            <TextField label={t("profile.address")} name="address"
              defaultValue={company.address} />
            <FieldRow>
              <TextField label={t("profile.primaryColor")} name="primaryColor" type="color"
                defaultValue={company.primaryColor} />
              <TextField label={t("profile.accentColor")} name="accentColor" type="color"
                defaultValue={company.accentColor} />
            </FieldRow>
        </>
      </SettingsForm>

      <SettingsForm
        title={t("quotes.title")}
        subtitle={t("quotes.subtitle")}
        action={saveQuoteSettingsAction}
      >
        <>
            <FieldRow columns={3}>
              <SelectField label={t("quotes.currency")} name="currency"
                defaultValue={company.currency} options={currencies}
                hint={t("quotes.currencyHint")} />
              <SelectField label={t("quotes.formatLocale")} name="formatLocale"
                defaultValue={company.formatLocale} options={formats}
                hint={t("quotes.formatLocaleHint")} />
              <SelectField label={t("quotes.timezone")} name="timezone"
                defaultValue={company.timezone} groups={timezones}
                hint={t("quotes.timezoneHint")} />
            </FieldRow>

            <FieldRow columns={3}>
              <SelectField label={t("quotes.defaultLanguage")} name="defaultLanguage"
                defaultValue={company.defaultLanguage}
                options={LOCALES.map((locale) => ({
                  value: locale === "es" ? Language.ES : Language.EN_GB,
                  label: LOCALE_NAMES[locale],
                }))} />
              <SelectField label={t("quotes.defaultTaxType")} name="defaultTaxType"
                defaultValue={company.defaultTaxType}
                options={Object.values(TaxType).map((type) => ({
                  value: type,
                  label: tQuotes(`taxType.${type}`),
                }))} />
              <TextField label={t("quotes.defaultTaxRate")} name="defaultTaxRate" type="number"
                defaultValue={String(Number(company.defaultTaxRate))} />
            </FieldRow>

            <SelectField label={t("quotes.taxDisplayMode")} name="taxDisplayMode"
              hint={t("quotes.taxDisplayModeHint")}
              defaultValue={company.taxDisplayMode}
              options={Object.values(TaxDisplayMode).map((mode) => ({
                value: mode,
                label: tQuotes(`taxDisplayMode.${mode}`),
              }))} />

            <FieldRow>
              <TextField label={t("quotes.quotePrefix")} name="quotePrefix" required
                defaultValue={company.quotePrefix} />
              <TextField label={t("quotes.quoteValidityDays")} name="quoteValidityDays" type="number"
                defaultValue={String(company.quoteValidityDays)} />
            </FieldRow>

            <RichAreaField label={t("quotes.quoteIntro")} name="quoteIntro"
              hint={t("quotes.quoteIntroHint")} defaultValue={company.quoteIntro} />
            <RichAreaField label={t("quotes.quoteNotes")} name="quoteNotes"
              defaultValue={company.quoteNotes} />
            <RichAreaField label={t("quotes.quoteExclusions")} name="quoteExclusions"
              defaultValue={company.quoteExclusions} />
            <RichAreaField label={t("quotes.quoteTerms")} name="quoteTerms"
              hint={t("quotes.quoteTermsHint")} defaultValue={company.quoteTerms} />
            <RichAreaField label={t("quotes.quoteScope")} name="quoteScope"
              hint={t("quotes.quoteScopeHint")} defaultValue={company.quoteScope} />
        </>
      </SettingsForm>

      <QuoteTypesManager
        types={quoteTypes}
        canManage={can(ctx, "settings.update")}
      />

      <SettingsForm
        title={t("acceptance.title")}
        subtitle={t("acceptance.subtitle")}
        action={saveAcceptanceSettingsAction}
      >
        <>
            <SelectField label={t("acceptance.mode")} name="acceptanceMode"
              defaultValue={company.acceptanceMode}
              options={Object.values(AcceptanceMode).map((mode) => ({
                value: mode,
                label: `${t(`acceptance.${mode}`)} — ${t(`acceptance.${mode}_hint`)}`,
              }))} />

            <AreaField label={t("acceptance.statement")} name="acceptanceStatement" rows={3}
              hint={t("acceptance.statementHint")} defaultValue={company.acceptanceStatement} />

            <CheckField label={t("acceptance.requireSignature")} name="requireSignature"
              hint={t("acceptance.requireSignatureHint")} defaultChecked={company.requireSignature} />
            <CheckField label={t("acceptance.askAdditionalComments")} name="askAdditionalComments"
              defaultChecked={company.askAdditionalComments} />
            <CheckField label={t("acceptance.askOrderReference")} name="askOrderReference"
              defaultChecked={company.askOrderReference} />
        </>
      </SettingsForm>
    </div>
  );
}
