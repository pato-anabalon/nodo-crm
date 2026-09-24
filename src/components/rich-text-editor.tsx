"use client";

import { useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useTranslations } from "next-intl";
import { Bold, Italic, Link2, List, ListOrdered, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Formatted-text editor for the descriptions the customer reads.
 *
 * The mark set is deliberately short — bold, italic, lists and links — because
 * this goes out in an email and onto paper: tables, colours or images render
 * broken in half the email clients and add nothing to a quote.
 *
 * The HTML is sanitised on the server when saving regardless: what's decided
 * here is convenience, not security.
 */
export function RichTextEditor({
  name,
  defaultValue,
  placeholder,
  ariaLabel,
}: {
  /** Hidden field carried by the form, so it works with server actions. */
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const t = useTranslations("editor");
  // What the form will post. Held here rather than in the DOM so that a
  // re-render of the form around it cannot quietly discard it.
  const [html, setHtml] = useState(defaultValue ?? "");

  const editor = useEditor({
    // Without this, Next warns about a server/client mismatch.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [3] },
        codeBlock: false,
        horizontalRule: false,
        blockquote: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https", "mailto", "tel"],
      }),
    ],
    content: defaultValue ?? "",
    onUpdate: ({ editor }) => setHtml(editor.isEmpty ? "" : editor.getHTML()),
    editorProps: {
      attributes: {
        class: cn(
          "min-h-40 w-full rounded-b-md border border-t-0 border-input bg-field px-3 py-2",
          "text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5",
          "[&_h3]:text-base [&_h3]:font-semibold [&_a]:underline",
        ),
        "aria-label": ariaLabel ?? "",
        ...(placeholder ? { "data-placeholder": placeholder } : {}),
      },
    },
  });

  return (
    <div>
      {/*
        Controlled by React state, and deliberately so.

        This used to be an uncontrolled field written to imperatively — the
        editor looked its input up in the document and assigned `.value`. It
        worked until the parent re-rendered: React restores an uncontrolled
        input to its `defaultValue`, the editor fires no `update` because its own
        content didn't change, and nobody puts the text back. So writing the
        scope of work and *then* filling in the title silently emptied it, and
        the save stored nothing. The text was on screen the whole time, which is
        what made it look like the save had dropped it.
      */}
      <input type="hidden" name={name} value={html} readOnly />

      <div className="flex flex-wrap items-center gap-0.5 rounded-t-md border border-input bg-muted/40 p-1">
        <Tool
          editor={editor}
          label={t("bold")}
          active={editor?.isActive("bold")}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" />
        </Tool>

        <Tool
          editor={editor}
          label={t("italic")}
          active={editor?.isActive("italic")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-4" />
        </Tool>

        <span className="mx-1 h-5 w-px bg-border" />

        <Tool
          editor={editor}
          label={t("bulletList")}
          active={editor?.isActive("bulletList")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="size-4" />
        </Tool>

        <Tool
          editor={editor}
          label={t("orderedList")}
          active={editor?.isActive("orderedList")}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-4" />
        </Tool>

        <span className="mx-1 h-5 w-px bg-border" />

        <Tool
          editor={editor}
          label={t("link")}
          active={editor?.isActive("link")}
          onClick={() => {
            const previous = editor?.getAttributes("link").href as string | undefined;
            // `prompt` blocks the tab but it's the only thing that doesn't need a
            // whole dialog just to paste a URL; swap it out if it grates.
            const url = window.prompt(t("linkPrompt"), previous ?? "https://");
            if (url === null) return;
            if (url === "") {
              editor?.chain().focus().unsetLink().run();
              return;
            }
            editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }}
        >
          <Link2 className="size-4" />
        </Tool>

        {editor?.isActive("link") ? (
          <Tool
            editor={editor}
            label={t("unlink")}
            onClick={() => editor?.chain().focus().unsetLink().run()}
          >
            <Unlink className="size-4" />
          </Tool>
        ) : null}
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

function Tool({
  editor,
  label,
  active,
  onClick,
  children,
}: {
  editor: Editor | null;
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className={cn("size-8", active && "bg-accent text-accent-foreground")}
      aria-label={label}
      aria-pressed={active ?? false}
      disabled={!editor}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
