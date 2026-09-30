"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { Option } from "@/lib/intl/options";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PricingMode, TaxDisplayMode } from "@/generated/prisma/enums";
import { RichTextEditor } from "@/components/rich-text-editor";
import { calculateQuoteTotals, taxIsInTotal } from "./totals";
import { formatMoney } from "@/lib/format";
import type { QuoteActionState } from "./actions";
import { useActionToast } from "@/lib/use-action-toast";

export type QuoteLineDraft = {
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
};

export type QuoteSectionDraft = {
  title: string;
  body: string;
  amount: string;
};

/** A line the company quotes often, offered so prices aren't retyped. */
export type CatalogueOption = {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  unitPrice: string;
};

export type QuoteFormDefaults = {
  title?: string;
  pricingMode?: PricingMode;
  sections?: QuoteSectionDraft[];
  intro?: string | null;
  exclusions?: string | null;
  leadId?: string | null;
  taxRate?: number;
  taxDisplayMode?: TaxDisplayMode;
  currency?: string;
  discount?: number;
  validUntil?: string | null;
  termsDocumentId?: string | null;
  notes?: string | null;
  terms?: string | null;
  items?: QuoteLineDraft[];
};

const EMPTY_LINE: QuoteLineDraft = { description: "", quantity: "1", unitPrice: "0", discount: "0" };
const EMPTY_SECTION: QuoteSectionDraft = { title: "", body: "", amount: "0" };

export function QuoteForm({
  catalogue = [],
  action,
  defaults = {},
  leads,
  documents,
  currency,
  currencies,
  formatLocale,
  taxDisplayMode,
  taxLabel,
  submitLabel,
}: {
  /** The company's price list, so common lines aren't retyped. */
  catalogue?: CatalogueOption[];
  action: (prev: QuoteActionState, formData: FormData) => Promise<QuoteActionState>;
  defaults?: QuoteFormDefaults;
  leads: Array<{ id: string; title: string }>;
  documents: Array<{ id: string; name: string }>;
  /** The company's currency, which is where every quote starts. */
  currency: string;
  /** Every currency, so a job invoiced abroad isn't stuck in the company's. */
  currencies: Option[];
  /** How the amounts look; it belongs to the company, not the user's language. */
  formatLocale: string;
  /** The company's own setting, suggested here and overridable per quote. */
  taxDisplayMode: TaxDisplayMode;
  /** The company's tax name (GST, VAT…), to label the breakdown. */
  taxLabel: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<QuoteActionState, FormData>(action, {});

  useActionToast(state);
  const t = useTranslations("quotes");
  const tCommon = useTranslations("common");
  const [items, setItems] = useState<QuoteLineDraft[]>(
    defaults.items?.length ? defaults.items : [{ ...EMPTY_LINE }],
  );
  const [taxRate, setTaxRate] = useState(String(defaults.taxRate ?? 15));
  const [pickedTaxDisplayMode, setPickedTaxDisplayMode] = useState(
    defaults.taxDisplayMode ?? taxDisplayMode,
  );
  const [pickedCurrency, setPickedCurrency] = useState(defaults.currency ?? currency);
  const [discount, setDiscount] = useState(String(defaults.discount ?? 0));
  const [pricingMode, setPricingMode] = useState<PricingMode>(
    defaults.pricingMode ?? PricingMode.ITEMIZED,
  );
  const [sections, setSections] = useState<QuoteSectionDraft[]>(
    defaults.sections?.length ? defaults.sections : [{ ...EMPTY_SECTION }],
  );

  const bySections = pricingMode === PricingMode.SECTIONS;

  // The same totals the server recalculates on save: here they're only a
  // preview, never submitted.
  const totals = useMemo(
    () =>
      calculateQuoteTotals({
        items: bySections
          ? []
          : items.map((item) => ({
              quantity: Number(item.quantity) || 0,
              unitPrice: Number(item.unitPrice) || 0,
              discount: Number(item.discount) || 0,
            })),
        sections: bySections ? sections.map((section) => Number(section.amount) || 0) : null,
        taxRate: Number(taxRate) || 0,
        discount: Number(discount) || 0,
        taxDisplayMode: pickedTaxDisplayMode,
      }),
    [bySections, items, sections, taxRate, discount, pickedTaxDisplayMode],
  );

  function updateSection(index: number, field: keyof QuoteSectionDraft, value: string) {
    setSections((current) =>
      current.map((section, i) => (i === index ? { ...section, [field]: value } : section)),
    );
  }

  /**
   * Copies a catalogue line onto the quote.
   *
   * A copy and not a reference: the quote keeps its own price, so changing the
   * catalogue later can't rewrite what the customer already received. The same
   * rule as every other field frozen on issue.
   */
  function addFromCatalogue(id: string) {
    const option = catalogue.find((item) => item.id === id);
    if (!option) return;

    setItems((current) => {
      const line: QuoteLineDraft = {
        description: [option.name, option.description].filter(Boolean).join(" — "),
        quantity: "1",
        unitPrice: option.unitPrice,
        discount: "0",
      };

      // An untouched first line is the empty one the form starts with; filling
      // it is friendlier than leaving a blank row above the real work.
      const blank =
        current.length === 1 &&
        current[0].description.trim() === "" &&
        Number(current[0].unitPrice) === 0;

      return blank ? [line] : [...current, line];
    });
  }

  function updateLine(index: number, field: keyof QuoteLineDraft, value: string) {
    setItems((current) =>
      current.map((line, i) => (i === index ? { ...line, [field]: value } : line)),
    );
  }

  // Follows the select rather than the prop, so the running totals beside it
  // are in the currency being chosen and not the one the company happens to use.
  const money = (value: number) => formatMoney(value, pickedCurrency, formatLocale);

  // One sentence per mode, spelling out what it does to this quote's own
  // numbers — the select's label names the mode, this says what it means.
  const taxHint =
    pickedTaxDisplayMode === TaxDisplayMode.NO_TAX
      ? t("form.noTaxHint")
      : pickedTaxDisplayMode === TaxDisplayMode.TAX_INCLUSIVE
        ? t("form.taxIncluded", { tax: taxLabel })
        : pickedTaxDisplayMode === TaxDisplayMode.TAX_EXCLUSIVE
          ? t("form.taxExcluded", { tax: taxLabel })
          : t("form.taxExclusiveInclusiveHint", { tax: taxLabel });

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-3">

      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("form.details")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t("form.title")}</Label>
              <Input id="title" name="title" required defaultValue={defaults.title} />
              {state.fieldErrors?.title ? (
                <p className="text-sm text-destructive">{state.fieldErrors.title[0]}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="leadId">{t("form.lead")}</Label>
                <NativeSelect
                  id="leadId"
                  name="leadId"
                  defaultValue={defaults.leadId ?? ""}
                  placeholder={t("form.noLead")}
                  options={leads.map((lead) => ({ value: lead.id, label: lead.title }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="validUntil">{t("form.validUntil")}</Label>
                <Input
                  id="validUntil"
                  name="validUntil"
                  type="date"
                  defaultValue={defaults.validUntil ?? ""}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("form.pricingMode.label")}</CardTitle>
          </CardHeader>
          <CardContent>
            <input type="hidden" name="pricingMode" value={pricingMode} />
            <div className="grid gap-3 sm:grid-cols-2">
              {[PricingMode.ITEMIZED, PricingMode.SECTIONS].map((mode) => {
                const selected = pricingMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPricingMode(mode)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <span className="block text-sm font-medium">
                      {t(`form.pricingMode.${mode}`)}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t(`form.pricingMode.${mode}_hint`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {bySections ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{t("form.sections")}</CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSections((current) => [...current, { ...EMPTY_SECTION }])}
              >
                <Plus className="size-4" />
                {t("form.addSection")}
              </Button>
            </CardHeader>

            <CardContent className="space-y-4">
              {state.fieldErrors?.sections ? (
                <p className="text-sm text-destructive">{state.fieldErrors.sections[0]}</p>
              ) : null}

              {sections.map((section, index) => (
                <div key={index} className="space-y-3 rounded-lg border p-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Label htmlFor={`sections[${index}].title`} className="text-xs">
                        {t("form.sectionTitle")}
                      </Label>
                      <Input
                        id={`sections[${index}].title`}
                        name={`sections[${index}].title`}
                        value={section.title}
                        onChange={(e) => updateSection(index, "title", e.target.value)}
                        placeholder={t("form.sectionTitlePlaceholder")}
                      />
                    </div>

                    <div className="w-40 space-y-1.5">
                      <Label htmlFor={`sections[${index}].amount`} className="text-xs">
                        {t("form.sectionAmount", { currency: pickedCurrency })}
                      </Label>
                      <Input
                        id={`sections[${index}].amount`}
                        name={`sections[${index}].amount`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={section.amount}
                        onChange={(e) => updateSection(index, "amount", e.target.value)}
                        className="tabular-nums"
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("form.removeSection", { position: index + 1 })}
                      disabled={sections.length === 1}
                      onClick={() =>
                        setSections((current) => current.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("form.sectionBody")}</Label>
                    {/* The content travels in a hidden field, so the form stays an
                        ordinary form. */}
                    <RichTextEditor
                      name={`sections[${index}].body`}
                      defaultValue={section.body}
                      ariaLabel={t("form.sectionBody")}
                      placeholder={t("form.sectionBodyPlaceholder")}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card className={bySections ? "hidden" : undefined}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t("form.lines")}</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setItems((current) => [...current, { ...EMPTY_LINE }])}
            >
              <Plus className="size-4" />
              {t("form.addLine")}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.fieldErrors?.items ? (
              <p className="text-sm text-destructive">{state.fieldErrors.items[0]}</p>
            ) : null}

            {catalogue.length > 0 ? (
              <div className="flex flex-wrap items-end gap-2 rounded-lg bg-panel p-3">
                <div className="min-w-56 flex-1 space-y-1.5">
                  <Label htmlFor="catalogue" className="text-xs">
                    {t("form.fromCatalogue")}
                  </Label>
                  <NativeSelect
                    id="catalogue"
                    value=""
                    onChange={(event) => addFromCatalogue(event.target.value)}
                    placeholder={t("form.pickFromCatalogue")}
                    options={catalogue.map((option) => ({
                      value: option.id,
                      label: option.unit ? `${option.name} · ${option.unit}` : option.name,
                    }))}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{t("form.catalogueHint")}</p>
              </div>
            ) : null}

            {items.map((line, index) => (
              <div key={index} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-12">
                <div className="space-y-1.5 sm:col-span-5">
                  <Label htmlFor={`items[${index}].description`} className="text-xs">
                    {t("form.lineDescription")}
                  </Label>
                  <Input
                    id={`items[${index}].description`}
                    name={`items[${index}].description`}
                    value={line.description}
                    onChange={(e) => updateLine(index, "description", e.target.value)}
                    placeholder={t("form.linePlaceholder")}
                  />
                </div>

                <NumberCell
                  index={index}
                  field="quantity"
                  label={t("form.quantity")}
                  value={line.quantity}
                  step="0.001"
                  onChange={updateLine}
                  className="sm:col-span-2"
                />
                <NumberCell
                  index={index}
                  field="unitPrice"
                  label={t("form.unitPrice")}
                  value={line.unitPrice}
                  step="1"
                  onChange={updateLine}
                  className="sm:col-span-2"
                />
                <NumberCell
                  index={index}
                  field="discount"
                  label={t("form.lineDiscount")}
                  value={line.discount}
                  step="0.01"
                  max="100"
                  onChange={updateLine}
                  className="sm:col-span-2"
                />

                <div className="flex items-end justify-between gap-2 sm:col-span-1">
                  <span className="text-sm tabular-nums sm:hidden">
                    {money(totals.lineTotals[index] ?? 0)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("form.removeLine", { position: index + 1 })}
                    disabled={items.length === 1}
                    onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <p className="hidden text-right text-sm tabular-nums text-muted-foreground sm:col-span-12 sm:block">
                  {t("form.lineSubtotal", { amount: money(totals.lineTotals[index] ?? 0) })}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("form.notesSection")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="intro">{t("form.intro")}</Label>
              <Textarea id="intro" name="intro" rows={3} defaultValue={defaults.intro ?? ""} />
              <p className="text-xs text-muted-foreground">{t("form.introHint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t("form.notes")}</Label>
              <Textarea id="notes" name="notes" rows={3} defaultValue={defaults.notes ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exclusions">{t("form.exclusions")}</Label>
              <Textarea
                id="exclusions"
                name="exclusions"
                rows={3}
                defaultValue={defaults.exclusions ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="terms">{t("form.terms")}</Label>
              <Textarea id="terms" name="terms" rows={3} defaultValue={defaults.terms ?? ""} />
            </div>

            {documents.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="termsDocumentId">{t("form.termsDocument")}</Label>
                <NativeSelect
                  id="termsDocumentId"
                  name="termsDocumentId"
                  defaultValue={defaults.termsDocumentId ?? ""}
                  placeholder={t("form.noTerms")}
                  options={documents.map((doc) => ({ value: doc.id, label: doc.name }))}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle className="text-base">{t("form.totals")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currency">{t("form.currency")}</Label>
              <NativeSelect
                id="currency"
                name="currency"
                value={pickedCurrency}
                onChange={(event) => setPickedCurrency(event.target.value)}
                options={currencies}
              />
              {pickedCurrency !== currency ? (
                <p className="text-xs text-muted-foreground">
                  {t("form.currencyDiffers", { currency })}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount">{t("form.globalDiscount", { currency: pickedCurrency })}</Label>
              <Input
                id="discount"
                name="discount"
                type="number"
                min={0}
                step="1"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxDisplayMode">{t("form.taxDisplayMode")}</Label>
              <NativeSelect
                id="taxDisplayMode"
                name="taxDisplayMode"
                value={pickedTaxDisplayMode}
                onChange={(event) =>
                  setPickedTaxDisplayMode(event.target.value as TaxDisplayMode)
                }
                options={Object.values(TaxDisplayMode).map((mode) => ({
                  value: mode,
                  label: t(`taxDisplayMode.${mode}`),
                }))}
              />
            </div>

            {pickedTaxDisplayMode !== TaxDisplayMode.NO_TAX ? (
              <div className="space-y-2">
                <Label htmlFor="taxRate">{t("form.taxRate")}</Label>
                <Input
                  id="taxRate"
                  name="taxRate"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                />
              </div>
            ) : (
              // Unmounting the field entirely would drop it from the posted
              // form, and `taxRate` would arrive as if nobody had ever set one —
              // the parser's fallback would then overwrite whatever rate this
              // quote actually had. Carrying it hidden is what lets `NO_TAX`
              // toggle back to a tax mode without the rate resetting under it.
              <input type="hidden" name="taxRate" value={taxRate} />
            )}

            <p className="text-xs text-muted-foreground">{taxHint}</p>

            <dl className="space-y-1.5 border-t pt-4 text-sm">
              <Row label={t("form.subtotal")} value={money(totals.subtotal)} />
              <Row label={t("form.discount")} value={`− ${money(totals.discount)}`} />
              {taxIsInTotal(pickedTaxDisplayMode) ? (
                <Row label={taxLabel} value={money(totals.taxAmount)} />
              ) : null}
              <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
                <dt>{t("form.total")}</dt>
                <dd className="tabular-nums">{money(totals.total)}</dd>
              </div>
            </dl>

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? tCommon("saving") : submitLabel}
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function NumberCell({
  index,
  field,
  label,
  value,
  step,
  max,
  onChange,
  className,
}: {
  index: number;
  field: keyof QuoteLineDraft;
  label: string;
  value: string;
  step: string;
  max?: string;
  onChange: (index: number, field: keyof QuoteLineDraft, value: string) => void;
  className?: string;
}) {
  const id = `items[${index}].${field}`;
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        name={id}
        type="number"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(index, field, e.target.value)}
        className="tabular-nums"
      />
    </div>
  );
}
