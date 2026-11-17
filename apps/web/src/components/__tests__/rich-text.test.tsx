import { render, screen } from "@testing-library/react";
import { RichText } from "../rich-text";

describe("RichText", () => {
  it("renders the formatting instead of printing the tags", () => {
    // The bug this component exists for: the panel showed "<p>Scope…</p>" as text.
    const { container } = render(<RichText html="<p>Scope of work:<br />Two coats</p>" />);

    expect(container.querySelector("p")).toBeInTheDocument();
    expect(container.querySelector("br")).toBeInTheDocument();
    expect(screen.getByText(/Scope of work:/)).toBeInTheDocument();
    expect(container.textContent).not.toContain("<p>");
  });

  it("keeps the marks the editor offers", () => {
    const { container } = render(
      <RichText html="<p><strong>bold</strong> and <em>italic</em></p><ul><li>one</li></ul>" />,
    );

    expect(container.querySelector("strong")).toBeInTheDocument();
    expect(container.querySelector("em")).toBeInTheDocument();
    expect(container.querySelector("li")).toBeInTheDocument();
  });

  it("strips a script that reached the stored value", () => {
    const { container } = render(
      <RichText html={'<p>ok</p><script>alert("xss")</script>'} />,
    );

    expect(container.querySelector("script")).not.toBeInTheDocument();
    expect(container.textContent).toBe("ok");
  });

  it("drops an event handler smuggled onto a tag", () => {
    const { container } = render(<RichText html={'<p onclick="evil()">text</p>'} />);

    expect(container.querySelector("p")?.getAttribute("onclick")).toBeNull();
  });

  it("carries the rich-text class the stylesheet hangs off", () => {
    const { container } = render(<RichText html="<p>x</p>" className="text-sm" />);

    expect(container.firstElementChild).toHaveClass("rich-text", "text-sm");
  });

  it("renders nothing at all when there is no content", () => {
    const { container } = render(<RichText html={null} />);
    expect(container).toBeEmptyDOMElement();

    const empty = render(<RichText html="" />);
    expect(empty.container).toBeEmptyDOMElement();
  });
});
