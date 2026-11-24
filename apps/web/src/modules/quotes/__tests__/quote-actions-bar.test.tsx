import { fireEvent, screen } from "@testing-library/react";
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
      hasLead
      onSend={async () => ({})}
      onDecide={async () => ({})}
      prepareEvidence={async () => ({})}
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

describe("QuoteActionsBar — sending without a lead", () => {
  it("disables Send when no lead is linked", () => {
    renderBar({ hasLead: false });
    expect(screen.getByRole("button", { name: "Send to customer" })).toBeDisabled();
  });

  it("leaves Send enabled once a lead is linked", () => {
    renderBar({ hasLead: true });
    expect(screen.getByRole("button", { name: "Send to customer" })).toBeEnabled();
  });
});

describe("QuoteActionsBar — declining", () => {
  it("asks why before declining, rather than declining on the press", () => {
    const onDecide = jest.fn(async () => ({}));
    renderBar({ status: QuoteStatus.SENT, canSend: false, canDecide: true, onDecide });

    fireEvent.click(screen.getByRole("button", { name: "Mark as declined" }));

    expect(onDecide).not.toHaveBeenCalled();
    const reason = screen.getByLabelText("Reason");
    expect(reason).toBeRequired();
    expect(screen.getByRole("option", { name: "Replaced by another quote" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline quote" })).toBeInTheDocument();
  });

  it("makes the note required only when the reason is Other", () => {
    renderBar({ status: QuoteStatus.SENT, canSend: false, canDecide: true });
    fireEvent.click(screen.getByRole("button", { name: "Mark as declined" }));

    expect(screen.getByLabelText("Note (optional)")).not.toBeRequired();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "OTHER" } });
    expect(screen.getByLabelText("Note")).toBeRequired();
  });
});

describe("QuoteActionsBar — accepting for the customer", () => {
  const sent = { status: QuoteStatus.SENT, canSend: false, canDecide: true };
  const evidence = () => screen.getByLabelText("Evidence from the customer") as HTMLInputElement;

  it("asks how they accepted and for their word, rather than accepting on the press", () => {
    const onDecide = jest.fn(async () => ({}));
    renderBar({ ...sent, onDecide });

    fireEvent.click(screen.getByRole("button", { name: "Mark as accepted" }));

    expect(onDecide).not.toHaveBeenCalled();
    expect(screen.getByLabelText("How they accepted")).toBeRequired();
    expect(screen.getByRole("option", { name: "The customer accepted by SMS or WhatsApp" })).toBeInTheDocument();
    expect(evidence()).toHaveAttribute("accept", "application/pdf,image/jpeg,image/png,image/webp");
  });

  it("won't accept without evidence", () => {
    const onDecide = jest.fn(async () => ({}));
    const prepareEvidence = jest.fn(async () => ({}));
    renderBar({ ...sent, onDecide, prepareEvidence });
    fireEvent.click(screen.getByRole("button", { name: "Mark as accepted" }));
    fireEvent.change(screen.getByLabelText("How they accepted"), { target: { value: "CUSTOMER_EMAIL" } });

    fireEvent.submit(screen.getByRole("button", { name: "Accept quote" }).closest("form")!);

    expect(screen.getByText("Attach the customer's acceptance: a screenshot or a document.")).toBeInTheDocument();
    expect(prepareEvidence).not.toHaveBeenCalled();
    expect(onDecide).not.toHaveBeenCalled();
  });

  it("lists what was chosen and turns away a file that can't be evidence", () => {
    renderBar(sent);
    fireEvent.click(screen.getByRole("button", { name: "Mark as accepted" }));

    const shot = new File(["x"], "whatsapp.png", { type: "image/png" });
    const sheet = new File(["x"], "notes.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    fireEvent.change(evidence(), { target: { files: [shot, sheet] } });

    expect(screen.getByText("whatsapp.png")).toBeInTheDocument();
    expect(screen.queryByText("notes.xlsx")).not.toBeInTheDocument();
    expect(screen.getByText("The file must be a PDF or an image.")).toBeInTheDocument();
  });
});
