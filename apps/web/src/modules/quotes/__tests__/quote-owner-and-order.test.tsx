// The service opens a database client on import; these tests never reach it.
jest.mock("@/lib/db/prisma", () => ({ prisma: {} }));

import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import type { CompanyContext } from "@/lib/auth/session";
import { QuoteStatus } from "@/generated/prisma/enums";
import { QuoteForm } from "../quote-form";
import { QuoteOwnerSelect } from "../quote-owner-select";
import { quoteFormDataToInput, quoteFormSchema } from "../schemas";
import { updateQuote } from "../service";

function renderForm(props: Partial<React.ComponentProps<typeof QuoteForm>> = {}) {
  return renderWithIntl(
    <QuoteForm
      action={jest.fn(async () => ({}))}
      searchLeads={async () => []}
      searchCatalogue={async () => []}
      documents={[{ id: "d1", name: "Terms.pdf" }]}
      currency="NZD"
      currencies={[{ value: "NZD", label: "NZD — New Zealand Dollar" }]}
      formatLocale="en-NZ"
      taxDisplayMode="TAX_EXCLUSIVE_INCLUSIVE_TOTAL"
      taxLabel="GST"
      submitLabel="Save changes"
      {...props}
    />,
  );
}

describe("the order of the quote's texts", () => {
  it("is notes, terms (with their document), then exclusions — as the customer reads them and the PDF prints them", () => {
    const { container } = renderForm();

    const position = (selector: string) => {
      const element = container.querySelector(selector);
      expect(element).not.toBeNull();
      return [...container.querySelectorAll("*")].indexOf(element!);
    };

    const notes = position('input[name="notes"]');
    const terms = position('input[name="terms"]');
    const document = position("#termsDocumentId");
    const exclusions = position('input[name="exclusions"]');

    expect(notes).toBeLessThan(terms);
    expect(terms).toBeLessThan(document);
    expect(document).toBeLessThan(exclusions);
  });
});

describe("handing a quote to somebody else", () => {
  const owners = [
    { id: "u1", name: "Rolando" },
    { id: "u2", name: "Ana" },
  ];

  it("starts on whoever has the quote, and lists the team", () => {
    renderWithIntl(<QuoteOwnerSelect ownerId="u2" owners={owners} />);

    const select = screen.getByLabelText("Owner");
    expect(select).toHaveValue("u2");
    expect([...select.querySelectorAll("option")].map((option) => option.textContent)).toEqual(
      expect.arrayContaining(["Rolando", "Ana"]),
    );
  });

  it("sits in the header but posts with the quote's own form, so Save changes carries it", () => {
    const { container } = renderWithIntl(
      <>
        <QuoteOwnerSelect ownerId="u1" owners={owners} />
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
        />
      </>,
    );

    const form = container.querySelector("form") as HTMLFormElement;
    const select = screen.getByLabelText("Owner") as HTMLSelectElement;

    // Not inside the form, yet part of it.
    expect(form.contains(select)).toBe(false);
    expect(select.form).toBe(form);

    fireEvent.change(select, { target: { value: "u2" } });
    expect(new FormData(form).get("ownerId")).toBe("u2");
  });

  it("is not part of the form unless it is given people to choose from", () => {
    renderForm();
    expect(screen.queryByLabelText("Owner")).not.toBeInTheDocument();
  });

  it("posts the chosen owner with the rest of the form, and reads it back as blank when untouched", () => {
    const form = new FormData();
    form.set("title", "Plastering");
    form.set("items[0].description", "Wall");
    form.set("items[0].quantity", "1");
    form.set("items[0].unitPrice", "100");
    const parse = () => quoteFormSchema.parse(quoteFormDataToInput(form));

    form.set("ownerId", "u2");
    expect(parse().ownerId).toBe("u2");

    form.set("ownerId", "");
    expect(parse().ownerId).toBeNull();
  });
});

describe("updateQuote — who may be made the owner", () => {
  function ctxWith(permissions: string[], member: unknown) {
    const membershipFind = jest.fn(async () => member);
    const ctx = {
      company: { id: "c1" },
      user: { id: "me" },
      permissions: new Set(permissions),
      db: {
        quote: {
          findFirst: jest.fn(async () => ({
            id: "q1",
            status: QuoteStatus.DRAFT,
            taxDisplayMode: "NO_TAX",
            leadId: null,
            number: 1,
            createdById: "u1",
          })),
        },
        membership: { findFirst: membershipFind },
      },
    } as unknown as CompanyContext;
    return { ctx, membershipFind };
  }

  const values = (ownerId: string | null) =>
    ({ ownerId, leadId: null, pricingMode: "ITEMIZED", sections: [], items: [] }) as never;

  it("refuses somebody who doesn't see every quote, without even looking the person up", async () => {
    const { ctx, membershipFind } = ctxWith(["quotes.update"], { id: "m" });

    const result = await updateQuote(ctx, "q1", values("u2"));

    expect(result).toEqual({ ok: false, reason: "owner-invalid" });
    expect(membershipFind).not.toHaveBeenCalled();
  });

  it("refuses a person who isn't an active member of the company", async () => {
    const { ctx, membershipFind } = ctxWith(["quotes.read.all"], null);

    const result = await updateQuote(ctx, "q1", values("stranger"));

    expect(result).toEqual({ ok: false, reason: "owner-invalid" });
    expect(membershipFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "stranger", status: "ACTIVE" }) }),
    );
  });
});

describe("reordering a quote's lines", () => {
  const lines = [
    { description: "Scaffold", quantity: "1", unitPrice: "100", discount: "0" },
    { description: "Plaster", quantity: "2", unitPrice: "50", discount: "0" },
    { description: "Paint", quantity: "3", unitPrice: "20", discount: "0" },
  ];

  const descriptions = () =>
    screen.getAllByLabelText("Description").map((input) => (input as HTMLInputElement).value);

  it("moves a line down with its button, and the order is what the form posts", () => {
    const { container } = renderForm({ defaults: { items: lines } });

    fireEvent.click(screen.getByRole("button", { name: "Move line 1 down" }));

    expect(descriptions()).toEqual(["Plaster", "Scaffold", "Paint"]);
    // Position on save is the order of the `items[n]` names, so they follow it.
    const posted = new FormData(container.querySelector("form") as HTMLFormElement);
    expect(posted.get("items[0].description")).toBe("Plaster");
    expect(posted.get("items[1].description")).toBe("Scaffold");
  });

  it("moves a line up, and carries its own price with it", () => {
    renderForm({ defaults: { items: lines } });

    fireEvent.click(screen.getByRole("button", { name: "Move line 3 up" }));

    expect(descriptions()).toEqual(["Scaffold", "Paint", "Plaster"]);
    const prices = screen.getAllByLabelText("Unit price").map((input) => (input as HTMLInputElement).value);
    expect(prices[1]).toContain("20");
    expect(prices[2]).toContain("50");
  });

  it("can't push the first line up or the last one down", () => {
    renderForm({ defaults: { items: lines } });

    expect(screen.getByRole("button", { name: "Move line 1 up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move line 3 down" })).toBeDisabled();
  });

  it("offers a grip on every line", () => {
    renderForm({ defaults: { items: lines } });
    expect(screen.getAllByRole("button", { name: /Drag to reorder line/ })).toHaveLength(3);
  });
});
