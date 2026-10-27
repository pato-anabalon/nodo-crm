import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Checkbox } from "@/components/ui/checkbox";

/*
 * Given a `name` inside a form, Radix renders a real `<input type="checkbox">`
 * beside the button — that is what the browser posts — and styles it
 * `position: absolute` inline. With no positioned ancestor it answers to the
 * document and lands at the foot of the page, giving the whole shell a
 * scrollbar with nothing on screen to explain it.
 *
 * jsdom computes no layout, so what is asserted is the cause rather than the
 * symptom: the input has a positioned parent.
 */
describe("Checkbox", () => {
  const hidden = () => document.querySelector<HTMLInputElement>('input[type="checkbox"]');

  it("posts through a hidden input, inside a positioned box", () => {
    render(
      <form>
        <Checkbox name="pricesIncludeTax" defaultChecked />
      </form>,
    );

    const input = hidden();
    expect(input).not.toBeNull();
    expect(input!.style.position).toBe("absolute");
    expect(input!.parentElement).toHaveClass("relative");
  });

  it("keeps `peer` on the control itself, which is what a label dims from", () => {
    render(<Checkbox aria-label="done" />);
    expect(screen.getByRole("checkbox")).toHaveClass("peer");
  });
});

/*
 * Radix answers a form `reset` by setting the box back to the value it mounted
 * with, which for a controlled one means `onCheckedChange(thatValue)`. React
 * resets the form every time a server action settles, so saving a profile's
 * permissions put every box back to how the page first loaded while the saved
 * set was already stored: the changes only showed after leaving and returning.
 */
describe("Checkbox inside a form that resets", () => {
  function Controlled() {
    const [on, setOn] = useState(false);
    return (
      <form data-testid="form">
        <Checkbox aria-label="send" checked={on} onCheckedChange={(v) => setOn(v === true)} />
      </form>
    );
  }

  it("keeps what the person ticked", async () => {
    render(<Controlled />);
    const box = screen.getByRole("checkbox", { name: "send" });

    fireEvent.click(box);
    expect(box).toHaveAttribute("aria-checked", "true");

    await act(async () => {
      (screen.getByTestId("form") as HTMLFormElement).reset();
    });
    expect(screen.getByRole("checkbox", { name: "send" })).toHaveAttribute("aria-checked", "true");
  });

  it("still reports a real click after a reset", async () => {
    render(<Controlled />);
    const box = screen.getByRole("checkbox", { name: "send" });

    await act(async () => {
      (screen.getByTestId("form") as HTMLFormElement).reset();
    });
    fireEvent.click(box);
    expect(box).toHaveAttribute("aria-checked", "true");
  });
});
