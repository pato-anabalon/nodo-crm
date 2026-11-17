import { render, screen } from "@testing-library/react";
import { SectionCard, SectionPrice } from "../section-card";

describe("SectionCard", () => {
  it("reads heading, then price, then the description — the order a phone shows them in", () => {
    const { container } = render(
      <SectionCard heading={<h2>Ceiling repairs</h2>} price={<span>$3,509.63</span>} tinted>
        <p>A very long scope of work</p>
      </SectionCard>,
    );

    const text = container.textContent ?? "";
    expect(text.indexOf("Ceiling repairs")).toBeLessThan(text.indexOf("$3,509.63"));
    expect(text.indexOf("$3,509.63")).toBeLessThan(text.indexOf("A very long scope"));
  });

  it("is a single column until 640px, and puts the price in a right-hand column from there", () => {
    const { container } = render(
      <SectionCard heading={<h2>Title</h2>} price={<span>$1</span>} tinted>
        <p>Body</p>
      </SectionCard>,
    );

    const article = container.querySelector("article")!;
    // Flex column by default (one column), a grid only at the breakpoint.
    expect(article.className).toMatch(/(^|\s)flex(\s|$)/);
    expect(article.className).toContain("flex-col");
    expect(article.className).toContain("sm:grid");
    expect(article.className).toContain("sm:grid-cols-[80%_20%]");
  });

  it("leaves no empty description block when there is nothing to describe", () => {
    const { container } = render(
      <SectionCard heading={<h2>Title</h2>} price={<span>$1</span>} tinted={false} />,
    );
    // Heading and price only.
    expect(container.querySelector("article")!.children).toHaveLength(2);
  });

  it("washes the price only when it should", () => {
    const { container, rerender } = render(
      <SectionCard heading={<h2>T</h2>} price={<span>$1</span>} tinted={false} />,
    );
    const strip = () => container.querySelector("article")!.children[1] as HTMLElement;
    expect(strip().className).not.toContain("bg-muted-foreground/10");

    rerender(<SectionCard heading={<h2>T</h2>} price={<span>$1</span>} tinted />);
    expect(strip().className).toContain("bg-muted-foreground/10");
  });
});

describe("SectionPrice", () => {
  it("shows just the figure when there is no discount", () => {
    render(<SectionPrice gross="$100.00" net="$100.00" discountLabel={null} />);
    expect(screen.getAllByText("$100.00")).toHaveLength(1);
  });

  it("shows the struck-through original, the discount and the net when there is one", () => {
    render(<SectionPrice gross="$100.00" net="$90.00" discountLabel="10% off" />);
    expect(screen.getByText("$100.00")).toHaveClass("line-through");
    expect(screen.getByText("10% off")).toBeInTheDocument();
    expect(screen.getByText("$90.00")).toBeInTheDocument();
  });
});
