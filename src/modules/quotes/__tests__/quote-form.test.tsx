import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "@/test/intl";
import { QuoteForm } from "../quote-form";

function renderForm() {
  const action = jest.fn(async () => ({}));
  renderWithIntl(
    <QuoteForm
      action={action}
      leads={[{ id: "lead_1", title: "Office network" }]}
      documents={[]}
      currency="NZD"
      currencies={[{ value: "NZD", label: "NZD — New Zealand Dollar" }]}
      formatLocale="en-NZ"
      taxDisplayMode="TAX_EXCLUSIVE_INCLUSIVE_TOTAL"
      taxLabel="GST"
      submitLabel="Create quote"
    />,
  );
  return { action };
}

describe("QuoteForm", () => {
  it("starts with one line and the total at zero", () => {
    renderForm();

    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByText("Total").closest("div")).toHaveTextContent("$0.00");
  });

  it("recalculates the totals as the line is typed", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.clear(screen.getByLabelText("Quantity"));
    await user.type(screen.getByLabelText("Quantity"), "3");
    await user.clear(screen.getByLabelText("Unit price"));
    await user.type(screen.getByLabelText("Unit price"), "450000");

    // 3 × 450,000 = 1,350,000, plus 15% GST = 1,552,500
    expect(screen.getByText("Subtotal").closest("div")).toHaveTextContent("1,350,000.00");
    expect(screen.getByText("Total").closest("div")).toHaveTextContent("1,552,500.00");
  });

  it("adds and removes lines", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /add line/i }));
    expect(screen.getAllByLabelText("Description")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Remove line 2" }));
    expect(screen.getAllByLabelText("Description")).toHaveLength(1);
  });

  it("does not allow deleting the only line left", () => {
    renderForm();
    expect(screen.getByRole("button", { name: "Remove line 1" })).toBeDisabled();
  });

  it("names each line's fields so the server can regroup them", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /add line/i }));

    expect(screen.getAllByLabelText("Description")[0]).toHaveAttribute("name", "items[0].description");
    expect(screen.getAllByLabelText("Description")[1]).toHaveAttribute("name", "items[1].description");
  });

  it("applies the overall discount to the total", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.clear(screen.getByLabelText("Unit price"));
    await user.type(screen.getByLabelText("Unit price"), "100000");
    await user.clear(screen.getByLabelText(/overall discount/i));
    await user.type(screen.getByLabelText(/overall discount/i), "10000");

    // (100,000 − 10,000) × 1.15 = 103,500
    expect(screen.getByText("Total").closest("div")).toHaveTextContent("103,500.00");
  });
});

describe("QuoteForm — modo de precio", () => {
  it("starts in itemised mode", () => {
    renderForm();

    expect(screen.getByRole("button", { name: /by line items/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  it("choosing sections asks for title, scope and price", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /by work sections/i }));

    expect(screen.getByLabelText(/section title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/scope of work/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^price/i)).toBeInTheDocument();
  });

  it("sums the sections and ignores the lines", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.clear(screen.getByLabelText("Unit price"));
    await user.type(screen.getByLabelText("Unit price"), "999999");

    await user.click(screen.getByRole("button", { name: /by work sections/i }));
    await user.clear(screen.getByLabelText(/^price/i));
    await user.type(screen.getByLabelText(/^price/i), "12000");

    // 12.000 + 15% de GST = 13.800
    expect(screen.getByText("Subtotal").closest("div")).toHaveTextContent("12,000.00");
    expect(screen.getByText("Total").closest("div")).toHaveTextContent("13,800.00");
  });

  it("adds sections and sums them all", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /by work sections/i }));
    await user.clear(screen.getAllByLabelText(/^price/i)[0]);
    await user.type(screen.getAllByLabelText(/^price/i)[0], "68575.50");

    await user.click(screen.getByRole("button", { name: /add section/i }));
    await user.clear(screen.getAllByLabelText(/^price/i)[1]);
    await user.type(screen.getAllByLabelText(/^price/i)[1], "16241.25");

    expect(screen.getByText("Subtotal").closest("div")).toHaveTextContent("84,816.75");
  });

  it("does not allow deleting the only section left", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /by work sections/i }));
    expect(screen.getByRole("button", { name: "Remove section 1" })).toBeDisabled();
  });

  it("submits the chosen mode to the server", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /by work sections/i }));

    const hidden = document.querySelector<HTMLInputElement>('input[name="pricingMode"]');
    expect(hidden?.value).toBe("SECTIONS");
  });
});

describe("QuoteForm — la moneda", () => {
  const CURRENCIES = [
    { value: "AED", label: "AED — UAE Dirham" },
    { value: "AUD", label: "AUD — Australian Dollar" },
    { value: "NZD", label: "NZD — New Zealand Dollar" },
  ];

  function renderWithCurrencies(defaults = {}) {
    renderWithIntl(
      <QuoteForm
        action={jest.fn(async () => ({}))}
        leads={[]}
        documents={[]}
        currency="NZD"
        currencies={CURRENCIES}
        formatLocale="en-NZ"
        taxDisplayMode="TAX_EXCLUSIVE_INCLUSIVE_TOTAL"
        taxLabel="GST"
        submitLabel="Save"
        defaults={defaults}
      />,
    );
    return screen.getByLabelText("Currency") as HTMLSelectElement;
  }

  it("starts on the company's currency, not on the first of the list", () => {
    expect(renderWithCurrencies()).toHaveValue("NZD");
  });

  it("starts on the quote's own currency when it has one", () => {
    expect(renderWithCurrencies({ currency: "AUD" })).toHaveValue("AUD");
  });

  it("formats the running totals in the currency being chosen", async () => {
    const user = userEvent.setup();
    const select = renderWithCurrencies();

    await user.clear(screen.getByLabelText("Unit price"));
    await user.type(screen.getByLabelText("Unit price"), "100");
    await user.selectOptions(select, "AUD");

    expect(screen.getByText("Total").closest("div")).toHaveTextContent("A$");
  });

  /** What a save used to leave behind: the record right, the picker on AED. */
  it("still shows the chosen currency after the form is reset", async () => {
    const user = userEvent.setup();
    const select = renderWithCurrencies();

    await user.selectOptions(select, "AUD");
    await act(async () => {
      select.form!.reset();
    });

    expect(select).toHaveValue("AUD");
  });
});

describe("QuoteForm — the tax rate under No tax", () => {
  function renderWithTaxMode(defaults = {}) {
    renderWithIntl(
      <QuoteForm
        action={jest.fn(async () => ({}))}
        leads={[]}
        documents={[]}
        currency="NZD"
        currencies={[{ value: "NZD", label: "NZD — New Zealand Dollar" }]}
        formatLocale="en-NZ"
        taxDisplayMode="TAX_EXCLUSIVE_INCLUSIVE_TOTAL"
        taxLabel="GST"
        submitLabel="Save"
        defaults={{ taxRate: 15, ...defaults }}
      />,
    );
    return screen.getByLabelText("Item pricing is") as HTMLSelectElement;
  }

  /**
   * The field disappears under "No tax", but it must not disappear from the
   * posted form: that's how a save under "No tax" once overwrote the
   * company's own rate with the parser's hardcoded fallback of 19, and the
   * field came back showing 19 the next time tax was turned back on.
   */
  it("keeps posting the rate, hidden, once No tax is picked", async () => {
    const user = userEvent.setup();
    const select = renderWithTaxMode();

    await user.selectOptions(select, "NO_TAX");

    expect(screen.queryByLabelText("Tax rate (%)")).not.toBeInTheDocument();
    const hidden = document.querySelector<HTMLInputElement>(
      'input[type="hidden"][name="taxRate"]',
    );
    expect(hidden?.value).toBe("15");
  });

  it("shows the rate it had before, not a hardcoded one, once tax is turned back on", async () => {
    const user = userEvent.setup();
    const select = renderWithTaxMode();

    await user.selectOptions(select, "NO_TAX");
    await user.selectOptions(select, "TAX_INCLUSIVE");

    expect(screen.getByLabelText("Tax rate (%)")).toHaveValue(15);
  });
});
