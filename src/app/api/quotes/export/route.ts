import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { getCompanyContext } from "@/lib/auth/session";
import { CSV_BOM, csvRow, exportColumns, quoteExportCells, yearOf } from "@/modules/quotes/export";
import { exportQuoteBatches } from "@/modules/quotes/export-service";
import { EXPORT_COOKIE, isExportToken } from "@/modules/quotes/export-token";

/**
 * The company's quotes for one calendar year, as a CSV.
 *
 * Three things hold it in: a profile has to be allowed to export **and** to read
 * quotes; it only ever gets the quotes it could open on screen (`ctx.db` and the
 * visibility filter inside `exportQuoteBatches`); and without `quotes.read.amounts`
 * the amount columns are not in the file at all.
 *
 * A year is required and there is no "all". The file is written as the rows are
 * read, a batch at a time, so a year of thousands costs a few index reads and no
 * memory to speak of.
 */
export async function GET(request: Request) {
  const ctx = await getCompanyContext();
  if (!ctx) return new NextResponse(null, { status: 401 });
  if (!ctx.permissions.has("quotes.export") || !ctx.permissions.has("quotes.read")) {
    return new NextResponse(null, { status: 403 });
  }

  const raw = new URL(request.url).searchParams.get("year") ?? "";
  const year = /^\d{4}$/.test(raw) ? Number(raw) : null;
  // Never in the future: nothing could be in it, and it would only be a way to
  // ask for an empty file.
  if (year === null || year < 2000 || year > yearOf(new Date(), ctx.company.timezone)) {
    return new NextResponse(null, { status: 400 });
  }

  const canSeeAmounts = ctx.permissions.has("quotes.read.amounts");
  const columns = exportColumns(canSeeAmounts);

  const [tColumns, tStatus, tTaxMode] = await Promise.all([
    getTranslations("quotes.export.columns"),
    getTranslations("quotes.status"),
    getTranslations("quotes.taxDisplayMode"),
  ]);
  const context = {
    quotePrefix: ctx.company.quotePrefix,
    timeZone: ctx.company.timezone,
    statusLabel: (status: string) => tStatus(status),
    taxModeLabel: (mode: string) => tTaxMode(mode),
  };

  const batches = exportQuoteBatches(ctx, year, canSeeAmounts);
  const encoder = new TextEncoder();
  let started = false;
  // The first batch is read before answering, so the response (and the cookie
  // the page waits for) only exists once there is a file to hand over.
  let first: Awaited<ReturnType<typeof batches.next>> | null = await batches.next();

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        let text = "";
        if (!started) {
          started = true;
          text = CSV_BOM + csvRow(columns.map((column) => tColumns(column)));
        }

        const next = first ?? (await batches.next());
        first = null;
        if (next.done) {
          if (text) controller.enqueue(encoder.encode(text));
          controller.close();
          return;
        }

        text += next.value.map((quote) => csvRow(quoteExportCells(quote, columns, context))).join("");
        controller.enqueue(encoder.encode(text));
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await batches.return(undefined);
    },
  });

  const headers = new Headers({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${ctx.company.slug}-quotes-${year}.csv"`,
    "Cache-Control": "no-store",
  });
  // Echoes the page's token so it can tell the download has started; see ExportForm.
  const token = new URL(request.url).searchParams.get("token");
  if (isExportToken(token)) headers.append("Set-Cookie", `${EXPORT_COOKIE}=${token}; Path=/; Max-Age=60; SameSite=Lax`);

  return new NextResponse(body, { headers });
}
