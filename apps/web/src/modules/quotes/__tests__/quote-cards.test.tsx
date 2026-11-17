import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { QUOTE_STATUS_SOFT_CLASS, QUOTE_STATUSES } from "../constants";
import { QuoteCard, type QuoteCardData } from "../quote-card";
import { QuoteCards } from "../quote-cards";

function quote(overrides: Partial<QuoteCardData> = {}): QuoteCardData {
  return {
    id: "q1",
    href: "/quotes/q1",
    title: "Plastering",
    reference: "COT-000017",
    customerName: "Patricio Anabalon",
    companyName: "Nodo Limited",
    statusLabel: "Sent",
    statusClass: QUOTE_STATUS_SOFT_CLASS.SENT,
    sent: "12 Oct 2026",
    seen: <span>Seen yesterday</span>,
    opensCount: <span>2</span>,
    opensLabel: <span>2 opens</span>,
    total: "$3,450.00",
    menu: <button type="button">Actions for Plastering</button>,
    ...overrides,
  };
}

/** Every datum the brief lists, so neither density may drop one. */
const EVERYTHING = [
  "Plastering",
  "COT-000017",
  "Patricio Anabalon",
  "Nodo Limited",
  "Sent",
  "12 Oct 2026",
  "Seen yesterday",
  "$3,450.00",
];

describe("QuoteCard", () => {
  it.each(["balanced", "compact"] as const)("%s shows every datum", (variant) => {
    renderWithIntl(<QuoteCard quote={quote()} variant={variant} />);
    for (const text of EVERYTHING) expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Actions for Plastering" })).toBeInTheDocument();
  });

  it("opens the quote through one real link, and keeps the menu outside it", () => {
    renderWithIntl(<QuoteCard quote={quote()} variant="compact" />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/quotes/q1");
    // A button inside the anchor would be invalid HTML and would navigate on press.
    expect(links[0]).not.toContainElement(screen.getByRole("button"));
    // The link is stretched over the card; the menu is stacked above that.
    expect(links[0]?.className).toContain("after:inset-0");
    expect(screen.getByRole("button").parentElement?.className).toContain("z-10");
  });

  it("carries the status as a word, whatever its colour", () => {
    renderWithIntl(<QuoteCard quote={quote()} variant="balanced" />);
    expect(screen.getByText("Sent", { selector: "span" })).toBeInTheDocument();
  });

  it("reads well with no customer at all", () => {
    renderWithIntl(
      <QuoteCard quote={quote({ customerName: null, companyName: null })} variant="compact" />,
    );
    expect(screen.getByText("—", { selector: "div" })).toBeInTheDocument();
  });

  it("is tighter in compact, and labels its fields in balanced", () => {
    const { container: balanced } = renderWithIntl(<QuoteCard quote={quote()} variant="balanced" />);
    const { container: compact } = renderWithIntl(<QuoteCard quote={quote()} variant="compact" />);

    expect(balanced.querySelector("article")?.className).toContain("p-5");
    expect(compact.querySelector("article")?.className).toContain("p-4");
    expect(within(balanced as HTMLElement).getByText("Opens")).toBeInTheDocument();
    expect(within(compact as HTMLElement).queryByText("Opens")).toBeNull();
  });
});

describe("the soft status badges", () => {
  it("cover every status the quote can have", () => {
    for (const status of QUOTE_STATUSES) expect(QUOTE_STATUS_SOFT_CLASS[status]).toContain("--status-");
  });

  it("use the status colours alone, never the company's", () => {
    for (const status of QUOTE_STATUSES) expect(QUOTE_STATUS_SOFT_CLASS[status]).not.toContain("--primary");
  });
});

describe("QuoteCards", () => {
  const KEY = "quotes.cardVariant:user-1";
  beforeEach(() => window.localStorage.clear());

  it("starts compact when nothing was chosen", () => {
    const { container } = renderWithIntl(<QuoteCards quotes={[quote()]} storageKey={KEY} empty="No quotes yet." />);
    expect(container.querySelector("article")?.getAttribute("data-variant")).toBe("compact");
    expect(screen.getByRole("radio", { name: "Compact" })).toBeChecked();
  });

  it("switches every card at once and remembers the choice", () => {
    const { container } = renderWithIntl(
      <QuoteCards
        quotes={[quote(), quote({ id: "q2", href: "/quotes/q2" })]}
        storageKey={KEY}
        empty="No quotes yet."
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Balanced" }));

    const variants = [...container.querySelectorAll("article")].map((card) => card.getAttribute("data-variant"));
    expect(variants).toEqual(["balanced", "balanced"]);
    expect(window.localStorage.getItem(KEY)).toBe("balanced");
  });

  it("restores a saved choice, but only under the same key", () => {
    window.localStorage.setItem(KEY, "balanced");

    const mine = renderWithIntl(<QuoteCards quotes={[quote()]} storageKey={KEY} empty="x" />);
    expect(mine.container.querySelector("article")?.getAttribute("data-variant")).toBe("balanced");
    mine.unmount();

    const someoneElse = renderWithIntl(
      <QuoteCards quotes={[quote()]} storageKey="quotes.cardVariant:user-2" empty="x" />,
    );
    expect(someoneElse.container.querySelector("article")?.getAttribute("data-variant")).toBe("compact");
  });

  it("ignores a stored value it doesn't know", () => {
    window.localStorage.setItem(KEY, "huge");
    const { container } = renderWithIntl(<QuoteCards quotes={[quote()]} storageKey={KEY} empty="x" />);
    expect(container.querySelector("article")?.getAttribute("data-variant")).toBe("compact");
  });

  it("names the group for assistive technology, and says so when the list is empty", () => {
    renderWithIntl(<QuoteCards quotes={[]} storageKey={KEY} empty="No quotes yet." />);
    expect(screen.getByRole("radiogroup", { name: "Card layout" })).toBeInTheDocument();
    expect(screen.getByText("No quotes yet.")).toBeInTheDocument();
  });
});
