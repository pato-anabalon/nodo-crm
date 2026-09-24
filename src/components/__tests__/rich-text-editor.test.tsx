import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { renderWithIntl } from "@/test/intl";
import { RichTextEditor } from "../rich-text-editor";

const hidden = () => document.querySelector<HTMLInputElement>('input[name="body"]');

/**
 * What's tested here is the scaffolding: which marks are offered, that the
 * content travels in a hidden field, and that the field name is the one passed in.
 *
 * Typing and applying formatting is **not** covered: ProseMirror needs real
 * `contenteditable`, `Selection` and `Range`, and jsdom implements them only
 * halfway. Faking it would give a test that passes while proving nothing, so
 * that gets verified in the browser.
 */
describe("RichTextEditor", () => {
  it("exposes only the marks email and print support", async () => {
    renderWithIntl(<RichTextEditor name="body" />);

    for (const label of ["Bold", "Italic", "Bulleted list", "Numbered list", "Link"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    // No tables, colours or images: they render broken in half the email clients.
    expect(screen.queryByRole("button", { name: /table|image|colour|color/i })).toBeNull();
  });

  it("leaves the content in a hidden field, so the form stays a form", () => {
    renderWithIntl(<RichTextEditor name="body" defaultValue="<p>Scope of work</p>" />);
    expect(hidden()).toHaveValue("<p>Scope of work</p>");
  });

  it("starts empty when there is no previous content", () => {
    renderWithIntl(<RichTextEditor name="body" />);
    expect(hidden()).toHaveValue("");
  });

  it("uses the name it is given, so it can be repeated per section", () => {
    renderWithIntl(<RichTextEditor name="sections[2].body" defaultValue="<p>x</p>" />);
    expect(document.querySelector('input[name="sections[2].body"]')).toHaveValue("<p>x</p>");
  });
});

/**
 * The bug this guards against lost work silently.
 *
 * The hidden field used to be uncontrolled and written to imperatively. React
 * restores an uncontrolled input to its `defaultValue` whenever the parent
 * re-renders, and the editor fires no `update` because its own content hasn't
 * changed — so writing the scope of work and *then* filling in the title emptied
 * the field without touching what was on screen. The save stored nothing and it
 * looked like the save had dropped it.
 *
 * ProseMirror needs a real `contenteditable`, so the editing itself can't be
 * driven here. What can be pinned is the part that failed: the field carries a
 * value React owns, and a re-render of the form around it leaves that value be.
 */
describe("RichTextEditor: the hidden field survives the form around it", () => {
  function Harness({ initial }: { initial: string }) {
    const [title, setTitle] = useState("");
    return (
      <form>
        <input aria-label="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <RichTextEditor name="sections[0].body" defaultValue={initial} ariaLabel="scope" />
      </form>
    );
  }

  const field = () =>
    document.querySelector<HTMLInputElement>('input[name="sections[0].body"]')!;

  it("starts from what was already saved", () => {
    renderWithIntl(<Harness initial="<p>alcance</p>" />);
    expect(field().value).toBe("<p>alcance</p>");
  });

  it("still holds it after the rest of the form is typed into", async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness initial="<p>alcance</p>" />);

    await user.type(screen.getByLabelText("title"), "Muro perimetral");

    expect(field().value).toBe("<p>alcance</p>");
  });

  it("is owned by React rather than written to the DOM", () => {
    renderWithIntl(<Harness initial="<p>alcance</p>" />);
    // `defaultValue` would be the uncontrolled shape that lost the text.
    expect(field().getAttribute("value")).toBe("<p>alcance</p>");
    expect(field().readOnly).toBe(true);
  });
});
