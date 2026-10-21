import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { LeadCard, type LeadCardData } from "../lead-card";
import { LeadCards } from "../lead-cards";

function lead(overrides: Partial<LeadCardData> = {}): LeadCardData {
  return {
    id: "l1",
    href: "/leads/l1",
    title: "Kitchen replaster",
    companyName: "Scott Builders",
    owner: "Ana",
    status: <span>Qualified</span>,
    quoteCount: 2,
    value: "$8,000.00",
    ...overrides,
  };
}

describe("LeadCard", () => {
  it.each(["balanced", "compact"] as const)("%s shows every datum", (variant) => {
    renderWithIntl(<LeadCard lead={lead()} variant={variant} />);
    for (const text of ["Kitchen replaster", "Scott Builders", "Ana", "Qualified", "$8,000.00"]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    // Balanced prints the number under its column's name; compact words it.
    expect(screen.getByText(variant === "balanced" ? "2" : "2 quotes")).toBeInTheDocument();
  });

  it("opens the lead through one stretched link", () => {
    renderWithIntl(<LeadCard lead={lead()} variant="compact" />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/leads/l1");
    expect(links[0]?.className).toContain("after:inset-0");
  });

  it("reads well with no company", () => {
    renderWithIntl(<LeadCard lead={lead({ companyName: null })} variant="balanced" />);
    expect(screen.queryByText("Scott Builders")).toBeNull();
  });
});

describe("LeadCards", () => {
  beforeEach(() => window.localStorage.clear());

  it("is compact until chosen, then remembers it under its own key", () => {
    const { container } = renderWithIntl(
      <LeadCards leads={[lead()]} storageKey="leads.cardVariant:u1" empty="No leads" />,
    );
    expect(container.querySelector("article")?.getAttribute("data-variant")).toBe("compact");

    fireEvent.click(screen.getByRole("radio", { name: "Balanced" }));
    expect(container.querySelector("article")?.getAttribute("data-variant")).toBe("balanced");
    expect(window.localStorage.getItem("leads.cardVariant:u1")).toBe("balanced");
    // The quotes screen's choice is a different key, so it is untouched.
    expect(window.localStorage.getItem("quotes.cardVariant:u1")).toBeNull();
  });

  it("says so when there is nothing to show", () => {
    renderWithIntl(<LeadCards leads={[]} storageKey="k" empty="No leads" />);
    expect(screen.getByText("No leads")).toBeInTheDocument();
  });
});
