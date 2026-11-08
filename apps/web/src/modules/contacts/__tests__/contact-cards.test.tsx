import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { ContactCard, type ContactCardData } from "../contact-card";
import { ContactCards } from "../contact-cards";

function contact(overrides: Partial<ContactCardData> = {}): ContactCardData {
  return {
    id: "c1",
    href: "/contacts/c1",
    name: "Sara Martínez",
    position: "Site manager",
    companyName: "Sara Limited",
    email: "sara@example.com",
    phone: "021 555 0101",
    leadCount: 3,
    ...overrides,
  };
}

describe("ContactCard", () => {
  it.each(["balanced", "compact"] as const)("%s shows every datum", (variant) => {
    renderWithIntl(<ContactCard contact={contact()} variant={variant} />);
    for (const text of ["Sara Martínez", "Site manager", "Sara Limited", "sara@example.com", "021 555 0101", "3"]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it("opens the contact through one stretched link, and lets the email and phone be pressed on their own", () => {
    renderWithIntl(<ContactCard contact={contact()} variant="compact" />);

    const open = screen.getByRole("link", { name: "Sara Martínez" });
    expect(open).toHaveAttribute("href", "/contacts/c1");
    expect(open.className).toContain("after:inset-0");

    const mail = screen.getByRole("link", { name: "sara@example.com" });
    const call = screen.getByRole("link", { name: "021 555 0101" });
    expect(mail).toHaveAttribute("href", "mailto:sara@example.com");
    expect(call).toHaveAttribute("href", "tel:021 555 0101");
    // Above the stretched link, and not nested inside it.
    expect(mail.className).toContain("z-10");
    expect(open).not.toContainElement(mail);
  });

  it("shows a dash, not a dead link, for a missing email or phone", () => {
    renderWithIntl(
      <ContactCard contact={contact({ email: null, phone: null, position: null, companyName: null })} variant="balanced" />,
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });
});

describe("ContactCards", () => {
  beforeEach(() => window.localStorage.clear());

  it("is compact until chosen and remembers it under its own key", () => {
    const { container } = renderWithIntl(
      <ContactCards contacts={[contact()]} storageKey="contacts.cardVariant:u1" empty="No contacts" />,
    );
    expect(container.querySelector("article")?.getAttribute("data-variant")).toBe("compact");

    fireEvent.click(screen.getByRole("radio", { name: "Balanced" }));
    expect(window.localStorage.getItem("contacts.cardVariant:u1")).toBe("balanced");
  });

  it("says so when there is nothing to show", () => {
    renderWithIntl(<ContactCards contacts={[]} storageKey="k" empty="No contacts" />);
    expect(screen.getByText("No contacts")).toBeInTheDocument();
  });
});
