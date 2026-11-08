import {
  CSV_BOM,
  QUOTE_EXPORT_COLUMNS,
  csvCell,
  csvRow,
  exportColumns,
  quoteExportCells,
  yearBounds,
  yearOf,
  type ExportableQuote,
} from "../export";

describe("exportColumns", () => {
  it("leaves the priced columns out, not empty, for a profile that can't see amounts", () => {
    const columns = exportColumns(false);
    for (const priced of ["currency", "subtotal", "discount", "tax", "total"]) {
      expect(columns).not.toContain(priced);
    }
    expect(columns).toContain("reference");
  });

  it("adds them, after everything else, for one that can", () => {
    const columns = exportColumns(true);
    expect(columns).toEqual(QUOTE_EXPORT_COLUMNS.map((column) => column.key));
    expect(columns.slice(-6)).toEqual(["taxMode", "currency", "subtotal", "discount", "tax", "total"]);
  });
});

describe("csvCell", () => {
  it("quotes what needs it and doubles the quotes inside", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("Smith, John")).toBe('"Smith, John"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
  });

  it("turns a text that would run as a formula into plain text", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvCell("+1 555")).toBe("'+1 555");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("writes a number as it is, even a negative one", () => {
    expect(csvCell(-12.5)).toBe("-12.5");
    expect(csvCell(0)).toBe("0");
  });

  it("writes nothing for an absent value", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("ends a row with CRLF, the way spreadsheets expect", () => {
    expect(csvRow(["a", 1, null])).toBe("a,1,\r\n");
    expect(CSV_BOM).toBe("﻿");
  });
});

describe("a year of the company's own clocks", () => {
  it("runs from midnight to midnight in its timezone, not in UTC", () => {
    const { from, to } = yearBounds(2025, "Pacific/Auckland");
    // Auckland is UTC+13 on 1 January: its new year starts the afternoon before.
    expect(from.toISOString()).toBe("2024-12-31T11:00:00.000Z");
    expect(to.toISOString()).toBe("2025-12-31T11:00:00.000Z");
  });

  it("puts a quote made late on 31 December in that year, though UTC is still the afternoon", () => {
    const late = new Date("2025-12-31T10:30:00.000Z"); // 23:30 in Auckland
    const { from, to } = yearBounds(2025, "Pacific/Auckland");
    expect(late >= from && late < to).toBe(true);
    expect(yearOf(late, "Pacific/Auckland")).toBe(2025);
    expect(yearOf(late, "UTC")).toBe(2025);
    expect(yearOf(new Date("2025-12-31T11:30:00.000Z"), "Pacific/Auckland")).toBe(2026);
  });

  it("makes consecutive years meet exactly, so nothing is counted twice or lost", () => {
    expect(yearBounds(2024, "Pacific/Auckland").to.getTime()).toBe(yearBounds(2025, "Pacific/Auckland").from.getTime());
  });
});

describe("quoteExportCells", () => {
  const quote: ExportableQuote = {
    number: 7,
    title: "Roof",
    status: "SENT",
    clientName: "Paula",
    clientCompanyName: null,
    clientEmail: "paula@test.nz",
    clientPhone: null,
    createdAt: new Date("2025-12-31T11:30:00.000Z"), // 1 Jan 2026 in Auckland
    sentAt: null,
    decidedAt: null,
    validUntil: null,
    currency: "NZD",
    share: { openCount: 3 },
    subtotal: { toString: () => "1000" },
    discount: { toString: () => "0" },
    taxAmount: { toString: () => "150" },
    taxDisplayMode: "TAX_INCLUSIVE",
    total: { toString: () => "1150" },
  };
  const context = { quotePrefix: "NQ", timeZone: "Pacific/Auckland", statusLabel: (s: string) => `[${s}]`, taxModeLabel: (m: string) => `<${m}>` };

  it("follows the columns it is given, dating in the company's zone and writing money plainly", () => {
    const cells = quoteExportCells(quote, exportColumns(true), context);
    expect(cells).toEqual([
      "NQ-000007", "Roof", "[SENT]", "Paula", null, "paula@test.nz", null,
      "2026-01-01", "", "", "", 3,
      "<TAX_INCLUSIVE>", "NZD", "1000.00", "0.00", "150.00", "1150.00",
    ]);
  });

  it("has exactly as many cells as the profile has columns", () => {
    expect(quoteExportCells(quote, exportColumns(false), context)).toHaveLength(exportColumns(false).length);
  });

  it("counts a quote nobody opened as zero opens", () => {
    const cells = quoteExportCells({ ...quote, share: null }, ["opens"], context);
    expect(cells).toEqual([0]);
  });
});
