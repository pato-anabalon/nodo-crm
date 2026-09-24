import { getTranslations } from "next-intl/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney, formatNumber } from "@/lib/format";
import type { RepRow } from "./service";

/**
 * How each person did, as a table rather than a chart.
 *
 * Four measures per person with names attached: a reader scans this for a
 * specific name, and no arrangement of bars beats a table at that.
 */
export async function RepTable({
  rows,
  currency,
  formatLocale,
}: {
  rows: RepRow[];
  currency: string;
  formatLocale: string;
}) {
  const t = await getTranslations("reports.reps");

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  const money = (value: number) => formatMoney(value, currency, formatLocale);
  const number = (value: number) => formatNumber(value, formatLocale);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("person")}</TableHead>
            <TableHead className="text-right">{t("leads")}</TableHead>
            <TableHead className="text-right">{t("sent")}</TableHead>
            <TableHead className="text-right">{t("accepted")}</TableHead>
            <TableHead className="text-right">{t("rate")}</TableHead>
            <TableHead className="text-right">{t("value")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.userId}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell className="text-right tabular-nums">{number(row.leads)}</TableCell>
              <TableCell className="text-right tabular-nums">{number(row.sent.count)}</TableCell>
              <TableCell className="text-right tabular-nums">{number(row.accepted.count)}</TableCell>
              <TableCell className="text-right tabular-nums">{row.rate}%</TableCell>
              <TableCell className="text-right tabular-nums">{money(row.accepted.value)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
