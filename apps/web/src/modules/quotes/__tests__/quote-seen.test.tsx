import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { OpenCount, QuotePresenceProvider, QuoteSeen, type PresenceMap } from "../quote-presence";

/**
 * "Unopened" is a claim about a link: there was one, and the customer didn't
 * follow it. Without a Nodo link — a draft, a quote marked as sent by hand, one
 * imported from another system — there's nothing to claim, and it used to sit
 * under "Accepted" on every imported quote.
 */
function renderRow(presence: PresenceMap, seenLabel: string | null) {
  renderWithIntl(
    <QuotePresenceProvider initial={presence}>
      <div data-testid="seen">
        <QuoteSeen quoteId="q1" seenLabel={seenLabel} />
      </div>
      <OpenCount quoteId="q1" />
    </QuotePresenceProvider>,
  );
}

describe("QuoteSeen", () => {
  it("says nothing about a quote that never had a Nodo link", () => {
    renderRow({}, null);
    expect(screen.getByTestId("seen")).toBeEmptyDOMElement();
    // …and agrees with the opens column, which shows its dash for the same reason.
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("says Unopened when there is a link nobody has followed", () => {
    renderRow({ q1: { viewingNow: false, openCount: 0 } }, null);
    expect(screen.getByText("Unopened")).toBeInTheDocument();
  });

  it("says when it was last seen", () => {
    renderRow({ q1: { viewingNow: false, openCount: 2 } }, "3 days ago");
    expect(screen.getByText("Seen 3 days ago")).toBeInTheDocument();
  });

  it("says the customer is on it right now, over when they last were", () => {
    renderRow({ q1: { viewingNow: true, openCount: 2 } }, "3 days ago");
    expect(screen.getByText("viewing now")).toBeInTheDocument();
    expect(screen.queryByText("Seen 3 days ago")).not.toBeInTheDocument();
  });
});
