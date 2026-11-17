"use client";

import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { useTranslations } from "next-intl";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  Code,
  Columns3,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Rows3,
  Strikethrough,
  Table as TableIcon,
  Trash2,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HIGHLIGHT_COLORS, TEXT_COLORS } from "@/lib/rich-text-palette";
import { cn } from "@/lib/utils";
import { promptLink, Tool } from "./rich-text-tools";

/**
 * The Message Board's editor: what the team writes for itself, read on a
 * screen and never mailed. It offers what the quote's editor deliberately
 * doesn't — headings, colour, alignment, tables — and the server's `full`
 * sanitising profile accepts exactly this and nothing more. Colours come from
 * the one palette both sides read.
 */
export function fullExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto", "tel"] },
    }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right"] }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
  ];
}

export function FullToolbar({ editor }: { editor: Editor | null }) {
  const t = useTranslations("editor");
  const chain = () => editor!.chain().focus();
  const on = (name: string, attributes?: Record<string, unknown>) => editor?.isActive(name, attributes) ?? false;
  const inTable = on("table");

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-t-md border border-input bg-muted/40 p-1">
      <Tool editor={editor} label={t("undo")} onClick={() => chain().undo().run()}>
        <Undo2 className="size-4" />
      </Tool>
      <Tool editor={editor} label={t("redo")} onClick={() => chain().redo().run()}>
        <Redo2 className="size-4" />
      </Tool>

      <Divider />

      <Tool editor={editor} label={t("heading2")} active={on("heading", { level: 2 })} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="size-4" />
      </Tool>
      <Tool editor={editor} label={t("heading3")} active={on("heading", { level: 3 })} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="size-4" />
      </Tool>

      <Divider />

      <Tool editor={editor} label={t("bold")} active={on("bold")} onClick={() => chain().toggleBold().run()}>
        <Bold className="size-4" />
      </Tool>
      <Tool editor={editor} label={t("italic")} active={on("italic")} onClick={() => chain().toggleItalic().run()}>
        <Italic className="size-4" />
      </Tool>
      <Tool editor={editor} label={t("underline")} active={on("underline")} onClick={() => chain().toggleUnderline().run()}>
        <Underline className="size-4" />
      </Tool>
      <Tool editor={editor} label={t("strike")} active={on("strike")} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough className="size-4" />
      </Tool>

      <Swatches
        editor={editor}
        label={t("textColor")}
        clearLabel={t("noColor")}
        icon={<Baseline className="size-4" />}
        colors={TEXT_COLORS}
        names={(key) => t(`colors.${key}`)}
        current={editor?.getAttributes("textStyle").color as string | undefined}
        onPick={(value) => chain().setColor(value).run()}
        onClear={() => chain().unsetColor().run()}
        swatch={(value) => <span className="text-base font-bold" style={{ color: value }}>A</span>}
      />
      <Swatches
        editor={editor}
        label={t("highlight")}
        clearLabel={t("noHighlight")}
        icon={<Highlighter className="size-4" />}
        colors={HIGHLIGHT_COLORS}
        names={(key) => t(`colors.${key}`)}
        current={editor?.getAttributes("highlight").color as string | undefined}
        onPick={(value) => chain().setHighlight({ color: value }).run()}
        onClear={() => chain().unsetHighlight().run()}
        swatch={(value) => <span className="size-4 rounded-sm border" style={{ backgroundColor: value }} />}
      />

      <Divider />

      <Tool editor={editor} label={t("alignLeft")} active={editor?.isActive({ textAlign: "left" }) ?? false} onClick={() => chain().setTextAlign("left").run()}>
        <AlignLeft className="size-4" />
      </Tool>
      <Tool editor={editor} label={t("alignCenter")} active={editor?.isActive({ textAlign: "center" }) ?? false} onClick={() => chain().setTextAlign("center").run()}>
        <AlignCenter className="size-4" />
      </Tool>
      <Tool editor={editor} label={t("alignRight")} active={editor?.isActive({ textAlign: "right" }) ?? false} onClick={() => chain().setTextAlign("right").run()}>
        <AlignRight className="size-4" />
      </Tool>

      <Divider />

      <Tool editor={editor} label={t("bulletList")} active={on("bulletList")} onClick={() => chain().toggleBulletList().run()}>
        <List className="size-4" />
      </Tool>
      <Tool editor={editor} label={t("orderedList")} active={on("orderedList")} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered className="size-4" />
      </Tool>
      <Tool editor={editor} label={t("quote")} active={on("blockquote")} onClick={() => chain().toggleBlockquote().run()}>
        <Quote className="size-4" />
      </Tool>
      <Tool editor={editor} label={t("code")} active={on("codeBlock")} onClick={() => chain().toggleCodeBlock().run()}>
        <Code className="size-4" />
      </Tool>

      <Divider />

      <Tool editor={editor} label={t("link")} active={on("link")} onClick={() => promptLink(editor, t("linkPrompt"))}>
        <Link2 className="size-4" />
      </Tool>
      {on("link") ? (
        <Tool editor={editor} label={t("unlink")} onClick={() => chain().unsetLink().run()}>
          <Unlink className="size-4" />
        </Tool>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn("size-8", inTable && "bg-accent text-accent-foreground")}
            aria-label={t("table")}
            disabled={!editor}
          >
            <TableIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            disabled={inTable}
            onSelect={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          >
            <TableIcon className="size-4" />
            {t("insertTable")}
          </DropdownMenuItem>
          {/* What can be done to a table only shows up inside one. */}
          {inTable ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => chain().addRowAfter().run()}>
                <Rows3 className="size-4" />
                {t("addRow")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => chain().addColumnAfter().run()}>
                <Columns3 className="size-4" />
                {t("addColumn")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => chain().deleteRow().run()}>{t("deleteRow")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => chain().deleteColumn().run()}>{t("deleteColumn")}</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => chain().deleteTable().run()}>
                <Trash2 className="size-4" />
                {t("deleteTable")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" />;
}

function Swatches({
  editor,
  label,
  clearLabel,
  icon,
  colors,
  names,
  current,
  onPick,
  onClear,
  swatch,
}: {
  editor: Editor | null;
  label: string;
  clearLabel: string;
  icon: React.ReactNode;
  colors: readonly { key: string; value: string }[];
  names: (key: string) => string;
  current: string | undefined;
  onPick: (value: string) => void;
  onClear: () => void;
  swatch: (value: string) => React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn("size-8", current && "bg-accent text-accent-foreground")}
          aria-label={label}
          disabled={!editor}
        >
          {icon}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {colors.map((color) => (
          <DropdownMenuItem key={color.key} onSelect={() => onPick(color.value)}>
            <span className="flex w-5 justify-center">{swatch(color.value)}</span>
            {names(color.key)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onClear}>{clearLabel}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
