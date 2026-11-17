"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { DAY_PRESETS, type PeriodKind } from "./period";

const ROLLING_PRESETS = [0, 7, 30, 90] as const;

/**
 * The panel controls, in a single row above the charts.
 *
 * Changing any of them navigates immediately: forcing an "apply" click just to
 * see another quarter turns exploration into paperwork.
 */
export function PeriodFilter({ years }: { years: number[] }) {
  const t = useTranslations("reports");
  const router = useRouter();
  const params = useSearchParams();

  const kind = (params.get("period") ?? "year") as PeriodKind;
  const year = params.get("year") ?? String(years[0]);
  const index = params.get("index") ?? "1";
  const days = params.get("days") ?? "30";
  const display = params.get("display") ?? "value";
  const rolling = params.get("rolling") ?? "0";

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) next.set(key, value);
    router.push(`/reports?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label={t("showing")}>
        <Select value={kind} onChange={(value) => update({ period: value })}>
          {(["year", "half", "quarter", "month", "days"] as const).map((option) => (
            <option key={option} value={option}>
              {t(`periods.${option}`)}
            </option>
          ))}
        </Select>
      </Field>

      {kind !== "days" ? (
        <Field label="—" srOnly>
          <Select value={year} onChange={(value) => update({ year: value })}>
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {kind === "quarter" || kind === "half" || kind === "month" ? (
        <Field label="—" srOnly>
          <Select value={index} onChange={(value) => update({ index: value })}>
            {indexOptions(kind).map((option) => (
              <option key={option} value={option}>
                {kind === "month"
                  ? t(`months.${option}`)
                  : kind === "quarter"
                    ? t("quarters", { index: option })
                    : t("halves", { index: option })}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {kind === "days" ? (
        <Field label="—" srOnly>
          <Select value={days} onChange={(value) => update({ days: value })}>
            {DAY_PRESETS.map((option) => (
              <option key={option} value={option}>
                {t("rollingDays", { days: option })}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field label={t("displayAs")}>
        <Select value={display} onChange={(value) => update({ display: value })}>
          <option value="value">{t("displayValue")}</option>
          <option value="average">{t("displayAverage")}</option>
          <option value="count">{t("displayCount")}</option>
        </Select>
      </Field>

      <Field label={t("rollingPeriod")}>
        <Select value={rolling} onChange={(value) => update({ rolling: value })}>
          {ROLLING_PRESETS.map((option) => (
            <option key={option} value={option}>
              {option === 0 ? t("noRolling") : t("rollingDays", { days: option })}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

function indexOptions(kind: PeriodKind): number[] {
  if (kind === "month") return Array.from({ length: 12 }, (_, i) => i + 1);
  if (kind === "quarter") return [1, 2, 3, 4];
  return [1, 2];
}

function Field({
  label,
  srOnly,
  children,
}: {
  label: string;
  srOnly?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative space-y-1.5">
      {/* `relative` for the same reason as the button: `sr-only` is absolute, and
          without a positioned ancestor it hangs off the document. */}
      <Label className={srOnly ? "sr-only" : "text-xs text-muted-foreground"}>{label}</Label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <NativeSelect
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-auto"
    >
      {children}
    </NativeSelect>
  );
}
