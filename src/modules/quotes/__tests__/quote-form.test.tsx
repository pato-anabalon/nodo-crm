import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "@/test/intl";
import { QuoteForm } from "../quote-form";

function renderForm() {
  const action = jest.fn(async () => ({}));
  renderWithIntl(
    <QuoteForm
      action={action}
      searchLeads={async () => []}
      searchCatalogue={async () => []}
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

describe("QuoteForm — the company's quote types", () => {
  it("doesn't show the field at all for a company with none configured", () => {
    renderForm();
    expect(screen.queryByLabelText("Quote type")).not.toBeInTheDocument();
  });

  it("starts on the first type, in the order the company set them", async () => {
    const action = jest.fn(async () => ({}));
    renderWithIntl(
      <QuoteForm
        action={action}
        searchLeads={async () => []}
        searchCatalogue={async () => []}
        documents={[]}
        quoteTypes={["Estimate For", "Quote For", "Variation For"]}
        currency="NZD"
        currencies={[{ value: "NZD", label: "NZD — New Zealand Dollar" }]}
        formatLocale="en-NZ"
        taxDisplayMode="TAX_EXCLUSIVE_INCLUSIVE_TOTAL"
        taxLabel="GST"
        submitLabel="Create quote"
      />,
    );

    expect(screen.getByLabelText("Quote type")).toHaveValue("Estimate For");
  });

  it("keeps the quote's own type selected when editing one", () => {
    renderWithIntl(
      <QuoteForm
        action={jest.fn(async () => ({}))}
        searchLeads={async () => []}
        searchCatalogue={async () => []}
        documents={[]}
        quoteTypes={["Estimate For", "Quote For", "Variation For"]}
        currency="NZD"
        currencies={[{ value: "NZD", label: "NZD — New Zealand Dollar" }]}
        formatLocale="en-NZ"
        taxDisplayMode="TAX_EXCLUSIVE_INCLUSIVE_TOTAL"
        taxLabel="GST"
        submitLabel="Save"
        defaults={{ quoteType: "Variation For" }}
      />,
    );

    expect(screen.getByLabelText("Quote type")).toHaveValue("Variation For");
  });
});

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

  it("reorders sections with the up and down buttons, not only by dragging", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /by work sections/i }));
    await user.type(screen.getAllByLabelText(/section title/i)[0], "First");
    await user.click(screen.getByRole("button", { name: /add section/i }));
    await user.type(screen.getAllByLabelText(/section title/i)[1], "Second");

    expect(screen.getByRole("button", { name: "Move section 1 up" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Move section 2 up" }));

    const titles = screen
      .getAllByLabelText(/section title/i)
      .map((el) => (el as HTMLInputElement).value);
    expect(titles).toEqual(["Second", "First"]);
  });

  it("submits the chosen mode to the server", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /by work sections/i }));

    const hidden = document.querySelector<HTMLInputElement>('input[name="pricingMode"]');
    expect(hidden?.value).toBe("SECTIONS");
  });
});

describe("QuoteForm — discounts", () => {
  it("a section's own percentage discount reduces its final price and the quote's subtotal", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /by work sections/i }));
    await user.clear(screen.getByLabelText(/^price/i));
    await user.type(screen.getByLabelText(/^price/i), "1000");

    // "Discount type" labels three different selects on this page (the
    // section's own, the bundle discount's, and the quote's overall one) —
    // targeted by id rather than by label text, which only the section's own
    // field carries.
    const sectionDiscountType = document.getElementById("sections[0].discountType")!;
    await user.selectOptions(sectionDiscountType, "PERCENT");
    const sectionDiscountValue = document.getElementById("sections[0].discountValue")!;
    await user.clear(sectionDiscountValue);
    await user.type(sectionDiscountValue, "10");

    expect(screen.getByText("Final price").closest("div")).toHaveTextContent("$900.00");
    // 900 net of the section's own discount, +15% GST = 1,035.
    expect(screen.getByText("Total").closest("div")).toHaveTextContent("1,035.00");
  });

  it("a flat section discount is clamped to its own price, never going negative", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /by work sections/i }));
    await user.clear(screen.getByLabelText(/^price/i));
    await user.type(screen.getByLabelText(/^price/i), "100");

    await user.clear(screen.getByLabelText("Discount (NZD)"));
    await user.type(screen.getByLabelText("Discount (NZD)"), "500");

    expect(screen.getByText("Final price").closest("div")).toHaveTextContent("$0.00");
  });

  it("the overall discount switches from a flat amount to a percentage of the gross", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.clear(screen.getByLabelText("Unit price"));
    await user.type(screen.getByLabelText("Unit price"), "1000");

    // Targeted by id, same reason as the section discount test above — three
    // fields on the page now share the "Discount type" label.
    const overallDiscountType = document.getElementById("discountType")!;
    await user.selectOptions(overallDiscountType, "PERCENT");
    await user.clear(screen.getByLabelText("Overall discount (%)"));
    await user.type(screen.getByLabelText("Overall discount (%)"), "10");

    // 1,000 − 10% = 900 net, +15% GST = 1,035.
    expect(screen.getByText("Discount").closest("div")).toHaveTextContent("100.00");
    expect(screen.getByText("Total").closest("div")).toHaveTextContent("1,035.00");
  });
});

describe("QuoteForm — section behaviour", () => {
  it("offers 'pre-selected' only once a section stops being independent", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /by work sections/i }));
    expect(screen.queryByText("Pre-selected for the customer")).not.toBeInTheDocument();

    const kind = document.getElementById("sections[0].kind")!;
    await user.selectOptions(kind, "OPTIONAL");

    expect(screen.getByText("Pre-selected for the customer")).toBeInTheDocument();
  });

  it("an optional section only counts toward the total once pre-selected", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /by work sections/i }));
    await user.clear(screen.getByLabelText(/^price/i));
    await user.type(screen.getByLabelText(/^price/i), "1000");

    const kind = document.getElementById("sections[0].kind")!;
    await user.selectOptions(kind, "OPTIONAL");

    // Not pre-selected yet: an optional section nobody's chosen contributes
    // nothing to the quote's own preview, same as the customer would see
    // before ticking it.
    expect(screen.getByText("Subtotal").closest("div")).toHaveTextContent("$0.00");

    await user.click(screen.getByRole("checkbox", { name: /pre-selected for the customer/i }));
    expect(screen.getByText("Subtotal").closest("div")).toHaveTextContent("1,000.00");
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
        searchLeads={async () => []}
        searchCatalogue={async () => []}
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
        searchLeads={async () => []}
        searchCatalogue={async () => []}
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

describe("QuoteForm — confirming an edit to a quote already sent", () => {
  function renderSent(action = jest.fn(async () => ({}))) {
    renderWithIntl(
      <QuoteForm
        action={action}
        searchLeads={async () => []}
        searchCatalogue={async () => []}
        documents={[]}
        currency="NZD"
        currencies={[{ value: "NZD", label: "NZD — New Zealand Dollar" }]}
        formatLocale="en-NZ"
        taxDisplayMode="TAX_EXCLUSIVE_INCLUSIVE_TOTAL"
        taxLabel="GST"
        submitLabel="Save changes"
        status="SENT"
        // Otherwise the title field's own `required` blocks the native
        // submission `requestSubmit()` performs before the confirm test
        // below ever reaches the action — same validation a real click on
        // a submit button would run.
        defaults={{ title: "Office network quote" }}
      />,
    );
    return action;
  }

  it("asks before submitting, rather than saving straight away", async () => {
    const user = userEvent.setup();
    const action = renderSent();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByText("This quote has already been sent")).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("submits only once the warning is confirmed", async () => {
    const user = userEvent.setup();
    const action = renderSent();

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    // The trigger and the dialog's own confirm button share a label on
    // purpose — the dialog's is whichever one opened last.
    const buttons = screen.getAllByRole("button", { name: "Save changes" });
    await user.click(buttons[buttons.length - 1]);

    expect(action).toHaveBeenCalled();
  });

  it("does not ask at all for a draft, or any other status", () => {
    renderWithIntl(
      <QuoteForm
        action={jest.fn(async () => ({}))}
        searchLeads={async () => []}
        searchCatalogue={async () => []}
        documents={[]}
        currency="NZD"
        currencies={[{ value: "NZD", label: "NZD — New Zealand Dollar" }]}
        formatLocale="en-NZ"
        taxDisplayMode="TAX_EXCLUSIVE_INCLUSIVE_TOTAL"
        taxLabel="GST"
        submitLabel="Save changes"
        status="DRAFT"
      />,
    );

    const submit = screen.getByRole("button", { name: "Save changes" });
    expect(submit).toHaveAttribute("type", "submit");
  });
});
