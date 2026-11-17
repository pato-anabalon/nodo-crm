"use client";

import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** One toolbar button, shared by both editors so the two toolbars can't drift apart in how a button behaves. */
export function Tool({
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

/** Sets, changes or clears the link under the cursor. An empty answer clears it. */
export function promptLink(editor: Editor | null, question: string) {
  const previous = editor?.getAttributes("link").href as string | undefined;
  // `prompt` blocks the tab but it's the only thing that doesn't need a
  // whole dialog just to paste a URL; swap it out if it grates.
  const url = window.prompt(question, previous ?? "https://");
  if (url === null) return;
  if (url === "") {
    editor?.chain().focus().unsetLink().run();
    return;
  }
  editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
}
