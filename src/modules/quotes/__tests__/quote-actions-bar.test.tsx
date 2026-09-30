import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { QuoteStatus } from "@/generated/prisma/enums";
import { QuoteActionsBar } from "../quote-actions-bar";

function renderBar(overrides: Partial<Parameters<typeof QuoteActionsBar>[0]> = {}) {
  renderWithIntl(
    <QuoteActionsBar
      quoteId="quote_1"
      status={QuoteStatus.DRAFT}
      canSend
      canDecide={false}
      onSend={async () => ({})}
      onDecide={async () => ({})}
      {...overrides}
    />,
  );
}

describe("QuoteActionsBar — preview", () => {
  it("sits to the left of Send, once the quote is sendable", () => {
    renderBar({ previewHref: "/quotes/quote_1/preview" });

    const buttons = screen.getAllByRole("link").concat(screen.getAllByRole("button"));
    const labels = buttons.map((el) => el.textContent);
    expect(labels.indexOf("Preview")).toBeLessThan(labels.indexOf("Send to customer"));

    expect(screen.getByRole("link", { name: "Preview" })).toHaveAttribute(
      "href",
      "/quotes/quote_1/preview",
    );
  });

  it("stays out of the bar without a preview route", () => {
    renderBar();
    expect(screen.queryByRole("link", { name: "Preview" })).not.toBeInTheDocument();
  });

  it("isn't offered once the quote is out for a decision — the share card has its own", () => {
    renderBar({
      status: QuoteStatus.SENT,
      canSend: false,
      canDecide: true,
      previewHref: "/quotes/quote_1/preview",
    });
    expect(screen.queryByRole("link", { name: "Preview" })).not.toBeInTheDocument();
  });
});
