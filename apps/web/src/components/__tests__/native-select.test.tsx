import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { NativeSelect } from "@/components/ui/native-select";

// Alphabetical, like the real currency list: the first option is the one the
// control falls back to, and it is never the one anybody meant.
const OPTIONS = [
  { value: "AED", label: "AED" },
  { value: "AUD", label: "AUD" },
  { value: "NZD", label: "NZD" },
];

function Controlled({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <form>
      <NativeSelect
        aria-label="currency"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        options={OPTIONS}
      />
      <output data-testid="state">{value}</output>
    </form>
  );
}

const reset = async (element: HTMLElement) =>
  act(async () => {
    (element as HTMLSelectElement).form!.reset();
  });

/**
 * React resets the form by itself every time a server action settles, so this
 * is not an edge case — it is what happens on every save. The record was always
 * stored correctly; it was the control that lied about it afterwards.
 */
describe("NativeSelect: the selection survives a form reset", () => {
  it("keeps the chosen value instead of falling back to the first option", async () => {
    const user = userEvent.setup();
    render(<Controlled initial="NZD" />);
    const select = screen.getByLabelText("currency");

    await user.selectOptions(select, "AUD");
    await reset(select);

    expect(select).toHaveValue("AUD");
  });

  it("leaves the state alone, so the control and the state still agree", async () => {
    const user = userEvent.setup();
    render(<Controlled initial="NZD" />);
    const select = screen.getByLabelText("currency");

    await user.selectOptions(select, "AUD");
    await reset(select);

    expect(screen.getByTestId("state")).toHaveTextContent("AUD");
    expect(select).toHaveValue("AUD");
  });

  it("returns an uncontrolled select to its default, not to the first option", async () => {
    const user = userEvent.setup();
    render(
      <form>
        <NativeSelect aria-label="currency" defaultValue="NZD" options={OPTIONS} />
      </form>,
    );
    const select = screen.getByLabelText("currency");

    await user.selectOptions(select, "AUD");
    await reset(select);

    expect(select).toHaveValue("NZD");
  });

  it("falls back to the placeholder when that is what the field started on", async () => {
    const user = userEvent.setup();
    render(
      <form>
        <NativeSelect aria-label="lead" defaultValue="" placeholder="No lead" options={OPTIONS} />
      </form>,
    );
    const select = screen.getByLabelText("lead");

    await user.selectOptions(select, "AUD");
    await reset(select);

    expect(select).toHaveValue("");
  });
});
