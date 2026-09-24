import { render, screen } from "@testing-library/react";
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
