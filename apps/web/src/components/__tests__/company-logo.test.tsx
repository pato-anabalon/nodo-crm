import { render, screen } from "@testing-library/react";
import { CompanyLogo, initials } from "../company-logo";

describe("initials", () => {
  it("uses the initials of the first two words", () => {
    expect(initials("Acme Ltda.")).toBe("AL");
    expect(initials("Comercial Los Andes")).toBe("CL");
  });

  it("with a single word it uses its first two letters", () => {
    expect(initials("Acme")).toBe("AC");
  });

  it("does not fall over on an empty name", () => {
    expect(initials("   ")).toBe("?");
  });
});

describe("CompanyLogo", () => {
  it("shows the company logo when one has been uploaded", () => {
    render(<CompanyLogo name="Acme Ltda." logoUrl="https://cdn.test/logo.png" />);

    const img = screen.getByAltText("Acme Ltda.");
    expect(img).toHaveAttribute("src", "https://cdn.test/logo.png");
  });

  it("falls back to initials while the company hasn't uploaded a logo", () => {
    render(<CompanyLogo name="Acme Ltda." logoUrl={null} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("AL")).toBeInTheDocument();
  });
});
