"use client";

import {
  useActionState,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  ChevronUp,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ConfirmButton } from "@/components/confirm-button";
import type { Option } from "@/lib/intl/options";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DiscountType,
  PricingMode,
  QuoteSectionKind,
  QuoteStatus,
  TaxDisplayMode,
} from "@/generated/prisma/enums";
import { RichTextEditor } from "@/components/rich-text-editor";
import { MoneyInput } from "@/components/money-input";
import {
  SearchCombobox,
  type SearchComboboxItem,
} from "@/components/search-combobox";
import { richTextToPlain, toRichTextHtml } from "@/lib/rich-text";
import type { CatalogueSearchItem } from "@/modules/catalogue/actions";
import { AttachmentsManager, type AttachmentRow } from "./attachments-manager";
import { calculateQuoteTotals, sectionNetAmount, taxIsInTotal } from "./totals";
import { resolveSelectedSectionAmounts } from "./section-selection";
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
  /** The section's own persisted id — absent from a template-sourced or
   * duplicated default, which never shares identity with another quote's
   * rows. Present, this is what `updateQuote` matches against to update the
   * row in place instead of replacing it, which is what lets its attachments
   * survive editing the quote around it. */
  id?: string;
  title: string;
  body: string;
  amount: string;
  /** Absent from a template-sourced default — its discount is a negotiated
   * term for one job, not something a template remembers. Defaulted to
   * FIXED/0 once the row enters the form's own state. */
  discountType?: DiscountType;
  discountValue?: string;
  /** A template's own sections carry `kind` (it's shape, reused across jobs)
   * but never `selectedByDefault` (a sales choice for this one customer). */
  kind?: QuoteSectionKind;
  selectedByDefault?: boolean;
  /** This section's own files, already on the server — empty for a
   * template-sourced or brand new row. */
  attachments?: AttachmentRow[];
};

/**
 * A section row in the editor, with a stable client-side id for drag
 * reordering and as a React key. For a section that already exists in the
 * database, this is its own real id — posted back on save, which is what
 * lets `updateQuote` update the row in place. For a brand new row it's
 * minted by `newSectionId()` instead, and simply won't match anything on
 * save, which is exactly what marks it as new.
 */
type SortableSectionDraft = QuoteSectionDraft & {
  id: string;
  /** Whether `id` is a real, saved row — not just this session's own
   * tracking id. Attachments can only be managed on a persisted section: an
   * unsaved one has nothing on the server yet to attach a file to. */
  persisted: boolean;
  // Defaulted once a row enters the form's own state (see `emptySection`
  // and the seeding below) — optional only on the wire-in `QuoteFormDefaults`
  // shape, where a template-sourced default may have neither.
  discountType: DiscountType;
  discountValue: string;
  kind: QuoteSectionKind;
  selectedByDefault: boolean;
  attachments: AttachmentRow[];
};

export type QuoteFormDefaults = {
  title?: string;
  quoteType?: string | null;
  projectAddress?: string | null;
  scope?: string | null;
  pricingMode?: PricingMode;
  sections?: QuoteSectionDraft[];
  intro?: string | null;
  exclusions?: string | null;
  leadId?: string | null;
  /** The currently linked lead's own title, so the combobox can show it
   * without having fetched every lead to find a match in. */
  leadTitle?: string | null;
  taxRate?: number;
  taxDisplayMode?: TaxDisplayMode;
  currency?: string;
  discount?: number;
  discountType?: DiscountType;
  optionalDiscountThreshold?: number | null;
  optionalDiscountType?: DiscountType | null;
  optionalDiscountValue?: number | null;
  validUntil?: string | null;
  termsDocumentId?: string | null;
  notes?: string | null;
  terms?: string | null;
  items?: QuoteLineDraft[];
};

const EMPTY_LINE: QuoteLineDraft = {
  description: "",
  quantity: "1",
  unitPrice: "0",
  discount: "0",
};

/**
 * `crypto.randomUUID` needs a secure context in the browser and isn't
 * guaranteed on every server runtime either — and this component's first
 * render happens on the server, not just in the browser. The id is never
 * posted, so collision resistance doesn't matter; only that it's stable and
 * unique enough for React's keys and dnd-kit's own id tracking.
 */
function newSectionId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `section-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** A fresh row needs its own id — never a shared constant spread into place. */
function emptySection(): SortableSectionDraft {
  return {
    id: newSectionId(),
    persisted: false,
    title: "",
    body: "",
    amount: "0",
    discountType: DiscountType.FIXED,
    discountValue: "0",
    kind: QuoteSectionKind.INDEPENDENT,
    selectedByDefault: false,
    attachments: [],
  };
}

export function QuoteForm({
  quoteId,
  uploadAttachment,
  deleteAttachment,
  hasCatalogue = false,
  searchLeads,
  searchCatalogue,
  action,
  defaults = {},
  documents,
  quoteTypes = [],
  currency,
  currencies,
  formatLocale,
  taxDisplayMode,
  taxLabel,
  submitLabel,
  status,
}: {
  /** Present only on the edit form — a section can only manage its own
   * attachments once the quote (and the section) actually exist on the
   * server, same reason the quote's own attachments card only ever appears
   * there too. `quotes/new/page.tsx` doesn't pass this. */
  quoteId?: string;
  /** Required alongside `quoteId` — a section's attachments manager needs
   * both to render at all. */
  uploadAttachment?: (
    quoteId: string,
    sectionId: string | null,
    prev: QuoteActionState,
    formData: FormData,
  ) => Promise<QuoteActionState>;
  deleteAttachment?: (quoteId: string, attachmentId: string) => Promise<QuoteActionState>;
  /** Whether the company has any price-list line at all — the "From
   * catalogue" picker searches the server instead of holding the list, so
   * this is all that's needed to decide whether to show it. */
  hasCatalogue?: boolean;
  /** Server Actions, passed down rather than imported here directly — same
   * reason `action`/`acceptAction` already cross into client components this
   * way elsewhere: importing a `"use server"` module pulls in everything
   * else it imports too, which is harmless in a real Next.js build (it gets
   * compiled down to an RPC stub) but drags `next/cache` straight into this
   * component's Jest tests. */
  searchLeads: (query: string) => Promise<SearchComboboxItem[]>;
  searchCatalogue: (query: string) => Promise<CatalogueSearchItem[]>;
  action: (
    prev: QuoteActionState,
    formData: FormData,
  ) => Promise<QuoteActionState>;
  defaults?: QuoteFormDefaults;
  documents: Array<{ id: string; name: string }>;
  /** The company's own list, ordered — the first is what a new quote starts
   * on. A company with none configured simply doesn't show the field. */
  quoteTypes?: string[];
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
  /** Present only on the edit form — gates the "you're about to change a
   * quote the customer already has" confirmation below. A new quote is
   * never `SENT`, so `quotes/new/page.tsx` doesn't pass this. */
  status?: QuoteStatus;
}) {
  const [state, formAction, pending] = useActionState<
    QuoteActionState,
    FormData
  >(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useActionToast(state);
  const t = useTranslations("quotes");
  const tCommon = useTranslations("common");
  const [items, setItems] = useState<QuoteLineDraft[]>(
    defaults.items?.length ? defaults.items : [{ ...EMPTY_LINE }],
  );
  const [selectedLead, setSelectedLead] = useState<SearchComboboxItem | null>(
    defaults.leadId
      ? { id: defaults.leadId, label: defaults.leadTitle ?? "" }
      : null,
  );
  const [taxRate, setTaxRate] = useState(String(defaults.taxRate ?? 15));
  const [pickedTaxDisplayMode, setPickedTaxDisplayMode] = useState(
    defaults.taxDisplayMode ?? taxDisplayMode,
  );
  const [pickedCurrency, setPickedCurrency] = useState(
    defaults.currency ?? currency,
  );
  const [discount, setDiscount] = useState(String(defaults.discount ?? 0));
  const [discountType, setDiscountType] = useState<DiscountType>(
    defaults.discountType ?? DiscountType.FIXED,
  );
  // "" rather than 0, so an untouched threshold reads as "not configured"
  // instead of "configured at zero" — same reason `optionalNumber` in the
  // schema keeps blank distinct from zero.
  const [optionalDiscountThreshold, setOptionalDiscountThreshold] = useState(
    defaults.optionalDiscountThreshold != null
      ? String(defaults.optionalDiscountThreshold)
      : "",
  );
  const [optionalDiscountType, setOptionalDiscountType] =
    useState<DiscountType>(
      defaults.optionalDiscountType ?? DiscountType.PERCENT,
    );
  const [optionalDiscountValue, setOptionalDiscountValue] = useState(
    defaults.optionalDiscountValue != null
      ? String(defaults.optionalDiscountValue)
      : "",
  );
  const [pricingMode, setPricingMode] = useState<PricingMode>(
    defaults.pricingMode ?? PricingMode.ITEMIZED,
  );
  const [sections, setSections] = useState<SortableSectionDraft[]>(
    defaults.sections?.length
      ? defaults.sections.map((section) => ({
          ...section,
          id: section.id ?? newSectionId(),
          persisted: !!section.id,
          discountType: section.discountType ?? DiscountType.FIXED,
          discountValue: section.discountValue ?? "0",
          kind: section.kind ?? QuoteSectionKind.INDEPENDENT,
          selectedByDefault: section.selectedByDefault ?? false,
          attachments: section.attachments ?? [],
        }))
      : [emptySection()],
  );
  const sectionSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const bySections = pricingMode === PricingMode.SECTIONS;

  // The same pipeline the server runs on save: each section's own discount,
  // then which ones count (every INDEPENDENT one, OPTIONAL ones by their own
  // `selectedByDefault` — nobody's picked anything yet here, this is "how the
  // quote looks the moment it's sent"), then the bundle discount, then the
  // overall discount and tax. Never a second implementation of any of it.
  const totals = useMemo(() => {
    const bundle =
      optionalDiscountThreshold !== "" && optionalDiscountValue !== ""
        ? {
            threshold: Number(optionalDiscountThreshold) || 0,
            type: optionalDiscountType,
            value: Number(optionalDiscountValue) || 0,
          }
        : null;

    return calculateQuoteTotals({
      items: bySections
        ? []
        : items.map((item) => ({
            quantity: Number(item.quantity) || 0,
            unitPrice: Number(item.unitPrice) || 0,
            discount: Number(item.discount) || 0,
          })),
      sections: bySections
        ? [
            resolveSelectedSectionAmounts(
              sections.map((section) => ({
                id: section.id,
                amount: Number(section.amount) || 0,
                discountType: section.discountType,
                discountValue: Number(section.discountValue) || 0,
                kind: section.kind,
                selectedByDefault: section.selectedByDefault,
              })),
              {},
              bundle,
            ).sectionsTotal,
          ]
        : null,
      taxRate: Number(taxRate) || 0,
      discount: Number(discount) || 0,
      discountType,
      taxDisplayMode: pickedTaxDisplayMode,
    });
  }, [
    bySections,
    items,
    sections,
    taxRate,
    discount,
    discountType,
    pickedTaxDisplayMode,
    optionalDiscountThreshold,
    optionalDiscountType,
    optionalDiscountValue,
  ]);

  function updateSection(
    index: number,
    field: keyof QuoteSectionDraft,
    value: string,
  ) {
    setSections((current) =>
      current.map((section, i) =>
        i === index ? { ...section, [field]: value } : section,
      ),
    );
  }

  /**
   * Reordering, two ways: the grip handle (`handleSectionDragEnd`, pointer or
   * keyboard, via dnd-kit's own `KeyboardSensor`) and these up/down buttons —
   * always available, and the only way to reorder without a pointer.
   * `position` on save stays purely this array's order; neither path needs
   * to touch anything else.
   */
  function moveSection(id: string, delta: 1 | -1) {
    setSections((current) => {
      const from = current.findIndex((section) => section.id === id);
      const to = from + delta;
      if (from === -1 || to < 0 || to >= current.length) return current;
      return arrayMove(current, from, to);
    });
  }

  /**
   * Purely a display choice, never posted and never touching `sections`
   * itself — collapsing a row to its title and price makes reordering a long
   * list of sections less of a scroll, without losing or resetting anything
   * inside it. Every section starts expanded, same as today.
   */
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(),
  );
  function toggleSectionCollapsed(id: string) {
    setCollapsedSections((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections((current) => {
      const from = current.findIndex((section) => section.id === active.id);
      const to = current.findIndex((section) => section.id === over.id);
      if (from === -1 || to === -1) return current;
      return arrayMove(current, from, to);
    });
  }

  /**
   * Copies a catalogue line onto the quote.
   *
   * A copy and not a reference: the quote keeps its own price, so changing the
   * catalogue later can't rewrite what the customer already received. The same
   * rule as every other field frozen on issue.
   */
  function addFromCatalogue(option: CatalogueSearchItem) {
    setItems((current) => {
      const line: QuoteLineDraft = {
        description: [option.name, option.description]
          .filter(Boolean)
          .join(" — "),
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

  function updateLine(
    index: number,
    field: keyof QuoteLineDraft,
    value: string,
  ) {
    setItems((current) =>
      current.map((line, i) =>
        i === index ? { ...line, [field]: value } : line,
      ),
    );
  }

  // Follows the select rather than the prop, so the running totals beside it
  // are in the currency being chosen and not the one the company happens to use.
  const money = (value: number) =>
    formatMoney(value, pickedCurrency, formatLocale);

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
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-6 lg:grid-cols-3"
    >
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("form.details")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={
                quoteTypes.length > 0
                  ? "grid gap-4 sm:grid-cols-[3fr_7fr]"
                  : undefined
              }
            >
              {quoteTypes.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="quoteType">{t("form.quoteType")}</Label>
                  <NativeSelect
                    id="quoteType"
                    name="quoteType"
                    defaultValue={defaults.quoteType ?? quoteTypes[0]}
                    options={quoteTypes.map((label) => ({
                      value: label,
                      label,
                    }))}
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="title">{t("form.title")}</Label>
                <Input
                  id="title"
                  name="title"
                  required
                  defaultValue={defaults.title}
                />
                {state.fieldErrors?.title ? (
                  <p className="text-sm text-destructive">
                    {state.fieldErrors.title[0]}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="projectAddress">{t("form.projectAddress")}</Label>
              <Input
                id="projectAddress"
                name="projectAddress"
                defaultValue={defaults.projectAddress ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scope">{t("form.scope")}</Label>
              {/* Plain text, not the rich editor the other three texts use —
                  it's a short line, not prose, and still travels through the
                  same `cleanBody`/`sanitizeRichText` pipeline server-side
                  (wrapped in a paragraph tag there), so the portal's
                  `RichText` render stays untouched and existing HTML-bearing
                  values still display read as plain text, not raw tags. */}
              <Input
                id="scope"
                name="scope"
                defaultValue={richTextToPlain(defaults.scope)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="leadId">{t("form.lead")}</Label>
                <SearchCombobox
                  id="leadId"
                  name="leadId"
                  value={selectedLead}
                  onSelect={setSelectedLead}
                  search={searchLeads}
                  placeholder={t("form.noLead")}
                  searchPlaceholder={t("form.searchLeads")}
                  emptyLabel={t("form.noLeadsFound")}
                  noneLabel={t("form.noLead")}
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
            <CardTitle className="text-base">
              {t("form.pricingMode.label")}
            </CardTitle>
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

        {/* Mounted-but-hidden rather than unmounted, same as the Lines card
            below: switching away from SECTIONS and back used to lose
            whatever was being typed into a section, which the Lines card was
            already protected against. */}
        <Card className={bySections ? undefined : "hidden"}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t("form.sections")}</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setSections((current) => [...current, emptySection()])
              }
            >
              <Plus className="size-4" />
              {t("form.addSection")}
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            {state.fieldErrors?.sections ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.sections[0]}
              </p>
            ) : null}

            <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div>
                <p className="text-sm font-medium">
                  {t("form.bundleDiscount.title")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("form.bundleDiscount.hint")}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="optionalDiscountThreshold"
                    className="text-xs"
                  >
                    {t("form.bundleDiscount.threshold")}
                  </Label>
                  <Input
                    id="optionalDiscountThreshold"
                    name="optionalDiscountThreshold"
                    type="number"
                    min={0}
                    step="1"
                    value={optionalDiscountThreshold}
                    onChange={(e) =>
                      setOptionalDiscountThreshold(e.target.value)
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="optionalDiscountType" className="text-xs">
                    {t("form.discountType.label")}
                  </Label>
                  <NativeSelect
                    id="optionalDiscountType"
                    name="optionalDiscountType"
                    value={optionalDiscountType}
                    onChange={(e) =>
                      setOptionalDiscountType(e.target.value as DiscountType)
                    }
                    options={[
                      {
                        value: DiscountType.PERCENT,
                        label: t("form.discountType.PERCENT"),
                      },
                      {
                        value: DiscountType.FIXED,
                        label: t("form.discountType.FIXED"),
                      },
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="optionalDiscountValue" className="text-xs">
                    {optionalDiscountType === DiscountType.PERCENT
                      ? t("form.discountValuePercent")
                      : t("form.discountValue", { currency: pickedCurrency })}
                  </Label>
                  {optionalDiscountType === DiscountType.PERCENT ? (
                    <Input
                      id="optionalDiscountValue"
                      name="optionalDiscountValue"
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={optionalDiscountValue}
                      onChange={(e) => setOptionalDiscountValue(e.target.value)}
                    />
                  ) : (
                    <MoneyInput
                      id="optionalDiscountValue"
                      name="optionalDiscountValue"
                      value={optionalDiscountValue}
                      onChange={setOptionalDiscountValue}
                      currency={pickedCurrency}
                      formatLocale={formatLocale}
                    />
                  )}
                  {state.fieldErrors?.optionalDiscountValue ? (
                    <p className="text-sm text-destructive">
                      {state.fieldErrors.optionalDiscountValue[0]}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <DndContext
              id="quote-sections"
              sensors={sectionSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleSectionDragEnd}
            >
              <SortableContext
                items={sections.map((section) => section.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {sections.map((section, index) => (
                    <SortableSectionRow
                      key={section.id}
                      id={section.id}
                      dragLabel={t("form.dragSectionHandle")}
                      canMoveUp={index > 0}
                      canMoveDown={index < sections.length - 1}
                      onMoveUp={() => moveSection(section.id, -1)}
                      onMoveDown={() => moveSection(section.id, 1)}
                      moveUpLabel={t("form.moveSectionUp", {
                        position: index + 1,
                      })}
                      moveDownLabel={t("form.moveSectionDown", {
                        position: index + 1,
                      })}
                      collapsed={collapsedSections.has(section.id)}
                      onToggleCollapsed={() => toggleSectionCollapsed(section.id)}
                      collapseLabel={t("form.collapseSection")}
                      expandLabel={t("form.expandSection")}
                      summary={
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span
                            className={`truncate text-sm ${
                              section.title
                                ? "font-medium"
                                : "text-muted-foreground italic"
                            }`}
                          >
                            {section.title || t("form.sectionUntitled")}
                          </span>
                          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                            {money(Number(section.amount) || 0)}
                          </span>
                        </div>
                      }
                    >
                      {/* The id a persisted row already has, or the
                          client-only tracking id of a brand new one —
                          `updateQuote` tells the two apart on save, and only
                          the first kind matches anything to update in place. */}
                      <input
                        type="hidden"
                        name={`sections[${index}].id`}
                        value={section.id}
                      />
                      {/* `grid` rather than `flex` — a fixed column template
                          keeps the title and price columns at the same width
                          and the same baseline on every row, instead of each
                          relying on `flex-wrap` to land the same way. */}
                      <div className="grid grid-cols-[1fr_160px_auto] items-end gap-3">
                        <div className="min-w-0 space-y-1.5">
                          <Label
                            htmlFor={`sections[${index}].title`}
                            className="text-xs"
                          >
                            {t("form.sectionTitle")}
                          </Label>
                          <Input
                            id={`sections[${index}].title`}
                            name={`sections[${index}].title`}
                            value={section.title}
                            onChange={(e) =>
                              updateSection(index, "title", e.target.value)
                            }
                            placeholder={t("form.sectionTitlePlaceholder")}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label
                            htmlFor={`sections[${index}].amount`}
                            className="text-xs"
                          >
                            {t("form.sectionAmount", {
                              currency: pickedCurrency,
                            })}
                          </Label>
                          <MoneyInput
                            id={`sections[${index}].amount`}
                            name={`sections[${index}].amount`}
                            value={section.amount}
                            onChange={(value) =>
                              updateSection(index, "amount", value)
                            }
                            currency={pickedCurrency}
                            formatLocale={formatLocale}
                            className="tabular-nums mb-0"
                          />
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t("form.removeSection", {
                            position: index + 1,
                          })}
                          disabled={sections.length === 1}
                          onClick={() =>
                            setSections((current) =>
                              current.filter((s) => s.id !== section.id),
                            )
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-end gap-3">
                        <div className="min-w-48 space-y-1.5">
                          <Label
                            htmlFor={`sections[${index}].kind`}
                            className="text-xs"
                          >
                            {t("form.sectionKind.label")}
                          </Label>
                          <NativeSelect
                            id={`sections[${index}].kind`}
                            name={`sections[${index}].kind`}
                            value={section.kind}
                            onChange={(e) =>
                              updateSection(index, "kind", e.target.value)
                            }
                            options={Object.values(QuoteSectionKind).map(
                              (kind) => ({
                                value: kind,
                                label: t(`form.sectionKind.${kind}`),
                              }),
                            )}
                          />
                        </div>

                        {section.kind !== QuoteSectionKind.INDEPENDENT ? (
                          <label className="flex items-center gap-2 pb-2 text-sm">
                            <Checkbox
                              name={`sections[${index}].selectedByDefault`}
                              checked={section.selectedByDefault}
                              onCheckedChange={(checked) =>
                                setSections((current) =>
                                  current.map((s, i) =>
                                    i === index
                                      ? {
                                          ...s,
                                          selectedByDefault: checked === true,
                                        }
                                      : s,
                                  ),
                                )
                              }
                            />
                            {t("form.sectionSelectedByDefault")}
                          </label>
                        ) : null}
                      </div>

                      {/* `items-start` rather than `items-end`: Final Price is
                          plain text, shorter than the other two columns'
                          label-plus-input stack, and bottom-aligning it left
                          its own label sitting visibly lower than "Discount
                          type"/"Discount value" above it. */}
                      <div className="grid grid-cols-[30%_30%_35%] items-start gap-3">
                        <div className="space-y-1.5">
                          <Label
                            htmlFor={`sections[${index}].discountType`}
                            className="text-xs"
                          >
                            {t("form.discountType.label")}
                          </Label>
                          <NativeSelect
                            id={`sections[${index}].discountType`}
                            name={`sections[${index}].discountType`}
                            value={section.discountType}
                            onChange={(e) =>
                              updateSection(
                                index,
                                "discountType",
                                e.target.value,
                              )
                            }
                            options={[
                              {
                                value: DiscountType.FIXED,
                                label: t("form.discountType.FIXED"),
                              },
                              {
                                value: DiscountType.PERCENT,
                                label: t("form.discountType.PERCENT"),
                              },
                            ]}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label
                            htmlFor={`sections[${index}].discountValue`}
                            className="text-xs"
                          >
                            {section.discountType === DiscountType.PERCENT
                              ? t("form.discountValuePercent")
                              : t("form.discountValue", {
                                  currency: pickedCurrency,
                                })}
                          </Label>
                          {section.discountType === DiscountType.PERCENT ? (
                            <Input
                              id={`sections[${index}].discountValue`}
                              name={`sections[${index}].discountValue`}
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              value={section.discountValue}
                              onChange={(e) =>
                                updateSection(
                                  index,
                                  "discountValue",
                                  e.target.value,
                                )
                              }
                            />
                          ) : (
                            <MoneyInput
                              id={`sections[${index}].discountValue`}
                              name={`sections[${index}].discountValue`}
                              value={section.discountValue}
                              onChange={(value) =>
                                updateSection(index, "discountValue", value)
                              }
                              currency={pickedCurrency}
                              formatLocale={formatLocale}
                            />
                          )}
                        </div>

                        <div className="space-y-1.5 text-right">
                          <p className="text-sm text-muted-foreground">
                            {t("form.sectionFinalPrice")}
                          </p>
                          <p className="text-lg font-medium tabular-nums">
                            {money(
                              sectionNetAmount({
                                amount: Number(section.amount) || 0,
                                discountType: section.discountType,
                                discountValue:
                                  Number(section.discountValue) || 0,
                              }),
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          {t("form.sectionBody")}
                        </Label>
                        {/* The content travels in a hidden field, so the form
                            stays an ordinary form. */}
                        <RichTextEditor
                          name={`sections[${index}].body`}
                          defaultValue={section.body}
                          ariaLabel={t("form.sectionBody")}
                          placeholder={t("form.sectionBodyPlaceholder")}
                        />
                      </div>

                      {quoteId && uploadAttachment && deleteAttachment && section.persisted ? (
                        <AttachmentsManager
                          quoteId={quoteId}
                          sectionId={section.id}
                          attachments={section.attachments}
                          canManage
                          formatLocale={formatLocale}
                          compact
                          uploadAction={uploadAttachment}
                          deleteAction={deleteAttachment}
                        />
                      ) : null}
                    </SortableSectionRow>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </CardContent>
        </Card>

        <Card className={bySections ? "hidden" : undefined}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t("form.lines")}</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setItems((current) => [...current, { ...EMPTY_LINE }])
              }
            >
              <Plus className="size-4" />
              {t("form.addLine")}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.fieldErrors?.items ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.items[0]}
              </p>
            ) : null}

            {hasCatalogue ? (
              <div className="flex flex-wrap items-end gap-2 rounded-lg bg-panel p-3">
                <div className="min-w-56 flex-1 space-y-1.5">
                  <Label htmlFor="catalogue" className="text-xs">
                    {t("form.fromCatalogue")}
                  </Label>
                  <SearchCombobox
                    id="catalogue"
                    value={null}
                    onSelect={(option) => {
                      if (option) addFromCatalogue(option);
                    }}
                    search={searchCatalogue}
                    placeholder={t("form.pickFromCatalogue")}
                    searchPlaceholder={t("form.searchCatalogue")}
                    emptyLabel={t("form.noCatalogueFound")}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("form.catalogueHint")}
                </p>
              </div>
            ) : null}

            {items.map((line, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-lg border p-3 sm:grid-cols-12"
              >
                <div className="space-y-1.5 sm:col-span-5">
                  <Label
                    htmlFor={`items[${index}].description`}
                    className="text-xs"
                  >
                    {t("form.lineDescription")}
                  </Label>
                  <Input
                    id={`items[${index}].description`}
                    name={`items[${index}].description`}
                    value={line.description}
                    onChange={(e) =>
                      updateLine(index, "description", e.target.value)
                    }
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
                <div className="space-y-1.5 sm:col-span-2">
                  <Label
                    htmlFor={`items[${index}].unitPrice`}
                    className="text-xs"
                  >
                    {t("form.unitPrice")}
                  </Label>
                  <MoneyInput
                    id={`items[${index}].unitPrice`}
                    name={`items[${index}].unitPrice`}
                    value={line.unitPrice}
                    onChange={(value) => updateLine(index, "unitPrice", value)}
                    currency={pickedCurrency}
                    formatLocale={formatLocale}
                    className="tabular-nums"
                  />
                </div>
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
                    onClick={() =>
                      setItems((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <p className="hidden text-right text-sm tabular-nums text-muted-foreground sm:col-span-12 sm:block">
                  {t("form.lineSubtotal", {
                    amount: money(totals.lineTotals[index] ?? 0),
                  })}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("form.notesSection")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("form.intro")}</Label>
              <RichTextEditor
                name="intro"
                defaultValue={toRichTextHtml(defaults.intro)}
                ariaLabel={t("form.intro")}
              />
              <p className="text-xs text-muted-foreground">
                {t("form.introHint")}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t("form.notes")}</Label>
              <RichTextEditor
                name="notes"
                defaultValue={toRichTextHtml(defaults.notes)}
                ariaLabel={t("form.notes")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("form.exclusions")}</Label>
              <RichTextEditor
                name="exclusions"
                defaultValue={toRichTextHtml(defaults.exclusions)}
                ariaLabel={t("form.exclusions")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("form.terms")}</Label>
              <RichTextEditor
                name="terms"
                defaultValue={toRichTextHtml(defaults.terms)}
                ariaLabel={t("form.terms")}
              />
            </div>

            {documents.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="termsDocumentId">
                  {t("form.termsDocument")}
                </Label>
                <NativeSelect
                  id="termsDocumentId"
                  name="termsDocumentId"
                  defaultValue={defaults.termsDocumentId ?? ""}
                  placeholder={t("form.noTerms")}
                  options={documents.map((doc) => ({
                    value: doc.id,
                    label: doc.name,
                  }))}
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="discountType">
                  {t("form.discountType.label")}
                </Label>
                <NativeSelect
                  id="discountType"
                  name="discountType"
                  value={discountType}
                  onChange={(event) =>
                    setDiscountType(event.target.value as DiscountType)
                  }
                  options={[
                    {
                      value: DiscountType.FIXED,
                      label: t("form.discountType.FIXED"),
                    },
                    {
                      value: DiscountType.PERCENT,
                      label: t("form.discountType.PERCENT"),
                    },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount">
                  {discountType === DiscountType.PERCENT
                    ? t("form.globalDiscountPercent")
                    : t("form.globalDiscount", { currency: pickedCurrency })}
                </Label>
                {discountType === DiscountType.PERCENT ? (
                  <Input
                    id="discount"
                    name="discount"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                ) : (
                  <MoneyInput
                    id="discount"
                    name="discount"
                    value={discount}
                    onChange={setDiscount}
                    currency={pickedCurrency}
                    formatLocale={formatLocale}
                  />
                )}
                {state.fieldErrors?.discount ? (
                  <p className="text-sm text-destructive">
                    {state.fieldErrors.discount[0]}
                  </p>
                ) : null}
              </div>
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
              <Row
                label={t("form.discount")}
                value={`− ${money(totals.discount)}`}
              />
              {taxIsInTotal(pickedTaxDisplayMode) ? (
                <Row label={taxLabel} value={money(totals.taxAmount)} />
              ) : null}
              <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
                <dt>{t("form.total")}</dt>
                <dd className="tabular-nums">{money(totals.total)}</dd>
              </div>
            </dl>

            {status === QuoteStatus.SENT ? (
              <ConfirmButton
                trigger={
                  <Button type="button" className="w-full" disabled={pending}>
                    {pending ? tCommon("saving") : submitLabel}
                  </Button>
                }
                title={t("form.confirmSentEditTitle")}
                description={
                  <>
                    {t("form.confirmSentEditBody")}
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {t("form.confirmSentEditNote")}
                    </span>
                  </>
                }
                confirmLabel={t("form.confirmSentEditConfirm")}
                confirmVariant="default"
                onConfirm={() => formRef.current?.requestSubmit()}
              />
            ) : (
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? tCommon("saving") : submitLabel}
              </Button>
            )}
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

/**
 * One section's row, made draggable.
 *
 * Two ways to reorder, not one: the grip handle answers to a pointer and to
 * dnd-kit's own keyboard sensor, but a drag is still nothing a screen reader
 * announces step by step — the chevrons beside it are a plain pair of
 * buttons that move a row up or down with an ordinary click, and work
 * exactly the same without a mouse.
 */
function SortableSectionRow({
  id,
  dragLabel,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  moveUpLabel,
  moveDownLabel,
  collapsed,
  onToggleCollapsed,
  collapseLabel,
  expandLabel,
  summary,
  children,
}: {
  id: string;
  dragLabel: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  moveUpLabel: string;
  moveDownLabel: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  collapseLabel: string;
  expandLabel: string;
  /** The section's title and entered price, shown in place of the full form
   * while it's collapsed. */
  summary: ReactNode;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      // Centred while collapsed — the left rail's own height otherwise sets
      // the row's height regardless of how short the summary is, which is
      // what left the row looking too tall and the text stuck at the top.
      // Top-aligned while expanded, where the rail is the shorter column
      // next to a full form and belongs anchored by the title, not centred
      // against the whole thing.
      className={`flex gap-2 rounded-lg border p-3 ${collapsed ? "items-center" : "items-start"} ${isDragging ? "opacity-50" : ""}`}
    >
      <div
        // Stacked normally, in a row while collapsed — three controls on top
        // of each other are most of that ~80px the row couldn't get under
        // even with the summary down to one line; laid out sideways instead,
        // the row can actually shrink to it.
        className={`flex shrink-0 items-center gap-0.5 ${collapsed ? "flex-row" : "flex-col pt-1"}`}
      >
        <button
          type="button"
          aria-label={dragLabel}
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={moveUpLabel}
          disabled={!canMoveUp}
          onClick={onMoveUp}
        >
          <ChevronUp className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={moveDownLabel}
          disabled={!canMoveDown}
          onClick={onMoveDown}
        >
          <ChevronDown className="size-3.5" />
        </Button>
      </div>
      {/* Not `space-y-3`: Tailwind puts that spacing on every child except
          the last one, so it sits on the toggle row itself — invisible in
          its own class list, since it comes from this parent selector, but
          very visible as a gap between the toggle row and the collapsed
          (so, invisible) content below it. Conditional instead, so there's
          nothing to close up when collapsed. */}
      <div className={`flex min-w-0 flex-1 flex-col ${collapsed ? "" : "gap-3"}`}>
        {/* Opposite corner from the drag/reorder controls on purpose — a
            second pair of chevrons right next to those would read as doing
            the same thing. Double chevrons here instead of single ones, so
            even the shape doesn't echo them. */}
        <div className="flex items-start gap-3">
          {collapsed ? <div className="min-w-0 flex-1">{summary}</div> : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            // `ml-auto` rather than `justify-between` on the row: with the
            // summary only ever mounted while collapsed, `justify-between`
            // had nothing to space this away from while expanded, and a
            // lone flex child under `justify-between` sits at the start, not
            // the end — the button landed top-left instead of top-right.
            className="ml-auto shrink-0"
            aria-label={collapsed ? expandLabel : collapseLabel}
            onClick={onToggleCollapsed}
          >
            {collapsed ? (
              <ChevronsUpDown className="size-3.5" />
            ) : (
              <ChevronsDownUp className="size-3.5" />
            )}
          </Button>
        </div>
        {/* Mounted either way, never unmounted — collapsing is a display
            choice, not a reason for the fields inside to stop posting with
            the rest of the form. A `grid-template-rows` transition rather
            than `hidden`/`max-height`: unlike `display: none`, a grid track
            size actually animates, and unlike `max-height` it needs no
            guessed-at ceiling taller than the content could ever get. */}
        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
            collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
          }`}
        >
          <div className="space-y-3 overflow-hidden">{children}</div>
        </div>
      </div>
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
