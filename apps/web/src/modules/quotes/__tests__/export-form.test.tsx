import { act, fireEvent, render, screen } from "@testing-library/react";
import { ExportForm } from "../export-form";
import { EXPORT_COOKIE } from "../export-token";

const labels = { year: "Year", yearHint: "hint", download: "Download CSV", preparing: "Preparing", preparingHint: "wait" };

beforeEach(() => {
  jest.useFakeTimers();
  // jsdom has no navigation: swallow the native submit.
  jest.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  document.cookie = `${EXPORT_COOKIE}=; Max-Age=0; Path=/`;
});

describe("ExportForm", () => {
  it("works where crypto.randomUUID doesn't exist (plain http)", () => {
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
    render(<ExportForm years={[2025]} labels={labels} />);
    const button = screen.getByRole("button", { name: "Download CSV" });
    fireEvent.submit(button.closest("form")!);
    expect(button).toBeDisabled();
  });

  it("disables the button and shows progress until the download's cookie arrives", () => {
    render(<ExportForm years={[2025, 2024]} labels={labels} />);
    const button = screen.getByRole("button", { name: "Download CSV" });
    expect(button).toBeEnabled();
    expect(screen.queryByRole("status")).toBeNull();

    fireEvent.submit(button.closest("form")!);
    expect(button).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Preparing");
    const token = (document.querySelector('input[name="token"]') as HTMLInputElement).value;
    expect(token).toMatch(/^[\w-]{8,64}$/);

    act(() => jest.advanceTimersByTime(1000));
    expect(button).toBeDisabled();

    document.cookie = `${EXPORT_COOKIE}=${token}; Path=/`;
    act(() => jest.advanceTimersByTime(300));
    expect(button).toBeEnabled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("gives up after a while so a failed download can't leave it disabled for good", () => {
    render(<ExportForm years={[2025]} labels={labels} />);
    const button = screen.getByRole("button", { name: "Download CSV" });
    fireEvent.submit(button.closest("form")!);
    act(() => jest.advanceTimersByTime(121_000));
    expect(button).toBeEnabled();
  });
});
