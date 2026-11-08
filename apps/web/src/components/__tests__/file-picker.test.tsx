import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilePicker } from "@/components/file-picker";

function Picker() {
  return (
    <form>
      <FilePicker
        id="file"
        name="file"
        accept="application/pdf"
        chooseLabel="Choose file"
        noneChosenLabel="No file chosen"
        submitLabel="Upload"
        pendingLabel="Uploading…"
      />
    </form>
  );
}

const pdf = () => new File(["x"], "terms.pdf", { type: "application/pdf" });

const input = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;

describe("FilePicker", () => {
  it("names the chosen file, because a hidden input can't", async () => {
    render(<Picker />);
    expect(screen.getByText("No file chosen")).toBeInTheDocument();

    await userEvent.upload(input(), pdf());

    expect(screen.getByText("terms.pdf")).toBeInTheDocument();
  });

  it("won't submit until a file is chosen", async () => {
    render(<Picker />);
    const upload = screen.getByRole("button", { name: "Upload" });
    expect(upload).toBeDisabled();

    await userEvent.upload(input(), pdf());

    expect(upload).toBeEnabled();
  });

  it("forgets the name when the form is reset", async () => {
    render(<Picker />);
    await userEvent.upload(input(), pdf());
    expect(screen.getByText("terms.pdf")).toBeInTheDocument();

    // React resets the form once a server action settles.
    await act(async () => {
      input().form!.reset();
      await Promise.resolve();
    });

    expect(screen.getByText("No file chosen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
  });

  /*
   * The regression that cost an afternoon: `sr-only` is `position: absolute`
   * with no offsets, so without a positioned ancestor the 1×1 input hangs off
   * the document and adds hundreds of pixels of empty scroll. jsdom computes no
   * layout, so what is asserted is the cause rather than the symptom.
   */
  it("keeps the hidden input inside a positioned box", () => {
    render(<Picker />);
    const hidden = input();
    expect(hidden).toHaveClass("sr-only");
    expect(hidden.parentElement).toHaveClass("relative");
  });
});
