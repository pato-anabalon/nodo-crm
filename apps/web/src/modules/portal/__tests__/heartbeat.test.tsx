import { act, render, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { PresenceHeartbeat } from "../heartbeat";

describe("PresenceHeartbeat", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response);
    // jsdom doesn't implement it; the component only ever calls it optionally.
    Object.defineProperty(navigator, "sendBeacon", {
      value: jest.fn(),
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("beats once on mount, marking the first as the opening", () => {
    render(<PresenceHeartbeat token="tok123" />);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/q/tok123/ping?first=1",
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
  });

  /**
   * This is the fix for a tab that closes reading as watched for up to the
   * whole presence window afterwards: `pagehide` fires as the page is torn
   * down, and the tab gets one last word in before it goes.
   */
  it("sends an explicit leaving beacon on pagehide", () => {
    render(<PresenceHeartbeat token="tok123" />);

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(navigator.sendBeacon).toHaveBeenCalledWith("/api/q/tok123/ping?leaving=1");
  });

  it("says nothing on pagehide if the tab was never recorded as watched", () => {
    jest.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");

    render(<PresenceHeartbeat token="tok123" />);
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(navigator.sendBeacon).not.toHaveBeenCalled();
  });

  /** Somebody on the team saved a change while the customer had the quote open. */
  it("says the quote was updated when a beat hears a newer revision, without reloading", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ revision: 3 }) } as Response);
    renderWithIntl(<PresenceHeartbeat token="tok123" revision={2} />);

    expect(await screen.findByText("This quote has just been updated.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "See the new version" })).toBeInTheDocument();
  });

  it("stays quiet while the page shows the current revision", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ revision: 2 }) } as Response);
    renderWithIntl(<PresenceHeartbeat token="tok123" revision={2} />);

    await act(async () => undefined);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
