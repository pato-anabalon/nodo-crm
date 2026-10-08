import { parseDocument } from "htmlparser2";
import { Element, Text as DomText, type ChildNode } from "domhandler";
import { Link, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { ReactElement, ReactNode } from "react";

/**
 * The sanitised rich text, for the PDF.
 *
 * `RichText` (the HTML component) hands the browser a string and lets it do the
 * layout; React PDF has no HTML parser of its own, so this is that same job
 * done by hand, over the one tag set `sanitizeRichText` ever lets through —
 * `p`, `br`, `strong`, `b`, `em`, `i`, `u`, `s`, `ul`, `ol`, `li`, `a`, `h3`,
 * `blockquote`. Anything else was already stripped before this ever sees it.
 */
export function RichTextPdf({
  html,
  style,
}: {
  html: string | null | undefined;
  style?: Style;
}) {
  if (!html) return null;
  const root = parseDocument(html);
  const blocks = renderBlocks(root.children as ChildNode[], "rt");
  if (blocks.length === 0) return null;
  return <View style={style}>{blocks}</View>;
}

const styles = StyleSheet.create({
  paragraph: { marginBottom: 6 },
  heading: { marginBottom: 4, fontFamily: "Geist", fontWeight: "bold", fontSize: 12 },
  list: { marginBottom: 6 },
  listItem: { flexDirection: "row", marginBottom: 2 },
  listBullet: { width: 14 },
  listItemText: { flex: 1 },
  blockquote: {
    marginBottom: 6,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: "#9ca3af",
    borderLeftStyle: "solid",
  },
  blockquoteText: { fontFamily: "Geist", fontStyle: "italic" },
  link: { color: "#2563eb", textDecoration: "underline" },
});

const INLINE_STYLE: Record<string, Style> = {
  strong: { fontFamily: "Geist", fontWeight: "bold" },
  b: { fontFamily: "Geist", fontWeight: "bold" },
  em: { fontFamily: "Geist", fontStyle: "italic" },
  i: { fontFamily: "Geist", fontStyle: "italic" },
  u: { textDecoration: "underline" },
  s: { textDecoration: "line-through" },
};

/** Block-level tags only — the ones `sanitizeRichText` allows as a document's
 * own structure rather than as a run of text inside one. */
function renderBlocks(nodes: ChildNode[], key: string): ReactElement[] {
  const out: ReactElement[] = [];

  nodes.forEach((node, index) => {
    const blockKey = `${key}-${index}`;

    if (node.type === "text") {
      const text = collapseWhitespace((node as DomText).data);
      if (text) out.push(<Text key={blockKey} style={styles.paragraph}>{text}</Text>);
      return;
    }

    if (node.type !== "tag") return;
    const el = node as Element;
    const children = el.children as ChildNode[];

    switch (el.name) {
      case "p":
        out.push(
          <Text key={blockKey} style={styles.paragraph}>
            {renderInline(children, blockKey)}
          </Text>,
        );
        break;
      case "h3":
        out.push(
          <Text key={blockKey} style={styles.heading}>
            {renderInline(children, blockKey)}
          </Text>,
        );
        break;
      case "blockquote":
        out.push(
          <View key={blockKey} style={styles.blockquote}>
            {renderBlocks(children, blockKey)}
          </View>,
        );
        break;
      case "ul":
      case "ol": {
        const items = children.filter(
          (child): child is Element => child.type === "tag" && child.name === "li",
        );
        out.push(
          <View key={blockKey} style={styles.list}>
            {items.map((li, liIndex) => (
              <View key={`${blockKey}-li-${liIndex}`} style={styles.listItem}>
                <Text style={styles.listBullet}>
                  {el.name === "ol" ? `${liIndex + 1}.` : "•"}
                </Text>
                <Text style={styles.listItemText}>
                  {renderInline(li.children as ChildNode[], `${blockKey}-li-${liIndex}`)}
                </Text>
              </View>
            ))}
          </View>,
        );
        break;
      }
      default:
        // An inline tag that landed at the top level (sanitiser keeps loose
        // content outside an allowed block) — give it a paragraph of its own
        // rather than dropping it.
        out.push(
          <Text key={blockKey} style={styles.paragraph}>
            {renderInline([el], blockKey)}
          </Text>,
        );
    }
  });

  return out;
}

/** Inline tags, returned as `Text`'s own children — a mix of plain strings
 * and nested styled `Text`/`Link` nodes, the way React PDF mixes a run. */
function renderInline(nodes: ChildNode[], key: string): ReactNode[] {
  const out: ReactNode[] = [];

  nodes.forEach((node, index) => {
    const childKey = `${key}-${index}`;

    if (node.type === "text") {
      const text = collapseWhitespace((node as DomText).data);
      if (text) out.push(text);
      return;
    }

    if (node.type !== "tag") return;
    const el = node as Element;
    const children = el.children as ChildNode[];

    if (el.name === "br") {
      out.push("\n");
      return;
    }

    if (el.name === "a") {
      const href = el.attribs.href;
      out.push(
        href ? (
          <Link key={childKey} src={href} style={styles.link}>
            {renderInline(children, childKey)}
          </Link>
        ) : (
          <Text key={childKey}>{renderInline(children, childKey)}</Text>
        ),
      );
      return;
    }

    const inlineStyle = INLINE_STYLE[el.name];
    if (inlineStyle) {
      out.push(
        <Text key={childKey} style={inlineStyle}>
          {renderInline(children, childKey)}
        </Text>,
      );
      return;
    }

    // Unrecognised wrapper (e.g. a stray `<p>` inside a list item, which
    // Tiptap's own list items are written as) — its content still counts.
    out.push(...renderInline(children, childKey));
  });

  return out;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ");
}
