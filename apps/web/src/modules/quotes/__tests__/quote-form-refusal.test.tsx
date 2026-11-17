import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "@/test/intl";
import { QuoteForm } from "../quote-form";
import type { QuoteActionState } from "../actions";

/**
 * A refused save must leave the form as it was.
 *
 * React resets a form whose `action` is a function every time that action
 * settles, refused or not, and Details is uncontrolled — so forgetting a
 * section's title used to wipe the title, address, scope and date already
 * typed. Lives apart from `quote-form.test.tsx` only to stay out of that
 * file's timeouts.
 */
function renderRefusing() {
  const refusal: QuoteActionState = {
    fieldErrors: { sections: ["Add at least one section"] },
  };
  const action = jest.fn(async () => refusal);
  renderWithIntl(
    <QuoteForm
      action={action}
      searchLeads={async () => []}
      searchCatalogue={async () => []}
      documents={[]}
      quoteTypes={["Estimate For", "Quote For"]}
      currency="NZD"
      currencies={[{ value: "NZD", label: "NZD — New Zealand Dollar" }]}
      formatLocale="en-NZ"
      taxDisplayMode="TAX_EXCLUSIVE_INCLUSIVE_TOTAL"
      taxLabel="GST"
      submitLabel="Create quote"
    />,
  );
  return { action };
}

describe("QuoteForm — a refused save", () => {
  it("keeps everything typed in Details", async () => {
    const user = userEvent.setup();
    const { action } = renderRefusing();

    await user.selectOptions(screen.getByLabelText("Quote type"), "Quote For");
    await user.type(screen.getByLabelText("Title"), "Replaster");
    await user.type(screen.getByLabelText("Project address"), "1A Irene Avenue");
    await user.type(screen.getByLabelText("Scope"), "Full exterior");
    await user.click(screen.getByRole("button", { name: "Create quote" }));

    await screen.findByText("Add at least one section");
    expect(action).toHaveBeenCalledTimes(1);

    expect(screen.getByLabelText("Quote type")).toHaveValue("Quote For");
    expect(screen.getByLabelText("Title")).toHaveValue("Replaster");
    expect(screen.getByLabelText("Project address")).toHaveValue("1A Irene Avenue");
    expect(screen.getByLabelText("Scope")).toHaveValue("Full exterior");
  }, 20_000);

  it("shows the refusal as an alert, not as loose red text", async () => {
    const user = userEvent.setup();
    renderRefusing();

    await user.type(screen.getByLabelText("Title"), "Replaster");
    await user.click(screen.getByRole("button", { name: "Create quote" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Add at least one section"),
    );
  }, 20_000);
});
