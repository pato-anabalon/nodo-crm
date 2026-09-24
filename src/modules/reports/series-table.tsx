"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { makeLongDateFormatter, makeValueFormatter, type ChartFormat } from "./format-client";
import type { SeriesPoint } from "./series";

/**
 * The same data as the chart, in a table.
 *
 * Not an extra: it's what makes the series readable with a screen reader, in
 * single-ink print, or when someone needs the exact figure for one day.
 */
export function SeriesTable({ points, format }: { points: SeriesPoint[]; format: ChartFormat }) {
  const t = useTranslations("reports");
  const [open, setOpen] = useState(false);

  const formatValue = useMemo(() => makeValueFormatter(format), [format]);
  const formatDate = useMemo(() => makeLongDateFormatter(format.formatLocale), [format.formatLocale]);

  if (points.length === 0) return null;

  return (
    <div className="space-y-2">
      <Button variant="ghost" size="sm" onClick={() => setOpen((value) => !value)}>
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
        {t("tableView")}
      </Button>

      {open ? (
        <div className="max-h-64 overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{t("tableDate")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("seriesTotal")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("seriesAccepted")}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.date} className="border-t">
                  <td className="px-3 py-1.5">{formatDate(point.date)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatValue(point.total)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatValue(point.accepted)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
