import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { AcceptanceMode } from "@/generated/prisma/enums";
import { AcceptPanel, type AcceptanceSettings } from "../accept-panel";
import { acceptQuoteSchema } from "../schemas";

const settings = (over: Partial<AcceptanceSettings> = {}): AcceptanceSettings => ({
  mode: AcceptanceMode.STATEMENT_WITH_CHECKBOX,
  statement: null,
  requireSignature: false,
  askAdditionalComments: true,
  askOrderReference: true,
  ...over,
});

function renderPanel(over: Partial<AcceptanceSettings> = {}) {
  return renderWithIntl(
    <AcceptPanel
      settings={settings(over)}
      viewerName="Bruno Díaz"
      acceptAction={async () => ({})}
      declineAction={async () => ({})}
    />,
  );
}

describe("AcceptPanel — who is accepting comes from the link", () => {
  it("asks for neither a name nor an email", () => {
    const { container } = renderPanel();
    expect(container.querySelector('input[name="name"]')).toBeNull();
    expect(container.querySelector('input[name="email"]')).toBeNull();
  });

  it("puts the link holder's name in the statement they tick", () => {
    renderPanel();
    expect(screen.getByText(/Bruno Díaz/)).toBeInTheDocument();
  });

  it("names them in the plain statement too", () => {
    renderPanel({ mode: AcceptanceMode.SIMPLE_STATEMENT });
    expect(screen.getByText(/Bruno Díaz/)).toBeInTheDocument();
  });

  it("keeps what the customer does fill in: comments and their reference", () => {
    const { container } = renderPanel();
    expect(container.querySelector('[name="additionalComments"]')).not.toBeNull();
    expect(container.querySelector('[name="orderReference"]')).not.toBeNull();
  });
});

describe("acceptQuoteSchema", () => {
  it("drops a posted name and email — the server signs with the link's", () => {
    const parsed = acceptQuoteSchema.parse({ name: "Somebody Else", email: "x@y.z" });
    expect(parsed).not.toHaveProperty("name");
    expect(parsed).not.toHaveProperty("email");
  });
});

describe("AcceptPanel — signing from a touch device", () => {
  function renderSigning(handoff?: { start: () => Promise<{ id: string; qrSvg: string }>; pollBase: string }) {
    return renderWithIntl(
      <AcceptPanel
        settings={settings({ requireSignature: true })}
        viewerName="Bruno Díaz"
        acceptAction={async () => ({})}
        declineAction={async () => ({})}
        signatureHandoff={handoff}
      />,
    );
  }

  it("isn't offered where nothing can be signed for real", () => {
    renderSigning();
    expect(screen.queryByRole("button", { name: /Sign from a touch device/ })).not.toBeInTheDocument();
  });

  it("shows the QR in place of the pad, and Cancel brings the pad back", async () => {
    const start = jest.fn(async () => ({ id: "h1", qrSvg: '<svg data-testid="qr"></svg>' }));
    const { container } = renderSigning({ start, pollBase: "/api/q/token/signature" });

    fireEvent.click(screen.getByRole("button", { name: /Sign from a touch device/ }));
    expect(await screen.findByText("Scan the QR code", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(start).toHaveBeenCalledTimes(1);
    expect(container.querySelector("canvas")).toBeNull();
    // The handoff travels with the form, for the server to check against.
    expect(container.querySelector('input[name="signatureHandoffId"]')).toHaveValue("h1");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(container.querySelector("canvas")).not.toBeNull();
    expect(container.querySelector('input[name="signatureHandoffId"]')).toHaveValue("");
  });
});
