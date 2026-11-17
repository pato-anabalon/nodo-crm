import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { ClientCard, type ClientCardData } from "../client-card";
import { ClientCards } from "../client-cards";

function client(overrides: Partial<ClientCardData> = {}): ClientCardData {
  return {
    id: "k1",
    href: "/clients/k1",
    name: "Scott Builders",
    taxId: "NZBN 9429",
    email: "hello@scott.example",
    phone: "09 555 0100",
    address: "1A Irene Avenue, Mt Eden, Auckland",
    peopleCount: 3,
    leadCount: 1,
    ...overrides,
  };
}

describe("ClientCard", () => {
  it.each(["balanced", "compact"] as const)("%s shows every datum, the address whole", (variant) => {
    renderWithIntl(<ClientCard client={client()} variant={variant} />);
    for (const text of ["Scott Builders", "NZBN 9429", "hello@scott.example", "09 555 0100", "1A Irene Avenue, Mt Eden, Auckland"]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it("words the counts in compact and labels them in balanced", () => {
    const compact = renderWithIntl(<ClientCard client={client()} variant="compact" />);
    expect(screen.getByText("3 people")).toBeInTheDocument();
    expect(screen.getByText("1 lead")).toBeInTheDocument();
    compact.unmount();

    renderWithIntl(<ClientCard client={client()} variant="balanced" />);
    expect(screen.getByText("People")).toBeInTheDocument();
    expect(screen.getByText("Leads")).toBeInTheDocument();
  });

  it("opens the company through one stretched link and keeps email and phone pressable apart", () => {
    renderWithIntl(<ClientCard client={client()} variant="compact" />);
    const open = screen.getByRole("link", { name: "Scott Builders" });
    expect(open).toHaveAttribute("href", "/clients/k1");
    expect(open.className).toContain("after:inset-0");
    expect(screen.getByRole("link", { name: "hello@scott.example" })).toHaveAttribute("href", "mailto:hello@scott.example");
    expect(screen.getByRole("link", { name: "09 555 0100" }).className).toContain("z-10");
  });

  it("shows dashes rather than dead links for what is missing", () => {
    renderWithIntl(
      <ClientCard client={client({ email: null, phone: null, address: null, taxId: null })} variant="balanced" />,
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getAllByText("—")).toHaveLength(3);
  });
});

describe("ClientCards", () => {
  beforeEach(() => window.localStorage.clear());

  it("is compact until chosen and remembers it under its own key", () => {
    const { container } = renderWithIntl(
      <ClientCards clients={[client()]} storageKey="clients.cardVariant:u1" empty="No companies" />,
    );
    expect(container.querySelector("article")?.getAttribute("data-variant")).toBe("compact");
    fireEvent.click(screen.getByRole("radio", { name: "Balanced" }));
    expect(window.localStorage.getItem("clients.cardVariant:u1")).toBe("balanced");
  });

  it("says so when there is nothing to show", () => {
    renderWithIntl(<ClientCards clients={[]} storageKey="k" empty="No companies" />);
    expect(screen.getByText("No companies")).toBeInTheDocument();
  });
});
