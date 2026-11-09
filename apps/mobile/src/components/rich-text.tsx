import { parseDocument } from "htmlparser2";
import type { ChildNode, Element } from "domhandler";
import type { ReactNode } from "react";
import { Linking, Text, View } from "react-native";
import { decodeEntities } from "@/lib/html";

/**
 * Notes and comments arrive as the HTML the web stores, sanitised again by the
 * server on the way out, and are drawn read-only. The tag set is the web's
 * fixed one, so a small walker over it beats a general HTML renderer: what
 * it doesn't know it draws as its text, never as nothing.
 *
 * The same idea as the PDF's own renderer (`portal/pdf/rich-text.tsx`).
 */
export function RichText({ html }: { html: string }) {
  const document = parseDocument(html);
  return <View className="gap-2">{blocks(document.children)}</View>;
}

const BLOCK = new Set(["p", "h1", "h2", "h3", "h4", "ul", "ol", "blockquote", "pre", "table", "hr", "div"]);

function blocks(nodes: ChildNode[]): ReactNode[] {
  const out: ReactNode[] = [];
  let inline: ChildNode[] = [];
  const flush = () => {
    if (inline.some((node) => node.type !== "text" || node.data.trim())) {
      out.push(
        <Text key={`t${out.length}`} className="text-body text-foreground">
          {inlines(inline)}
        </Text>,
      );
    }
    inline = [];
  };

  for (const node of nodes) {
    if (node.type === "tag" && BLOCK.has(node.name)) {
      flush();
      out.push(block(node, out.length));
    } else {
      inline.push(node);
    }
  }
  flush();
  return out;
}

function block(node: Element, key: number): ReactNode {
  switch (node.name) {
    case "h1":
    case "h2":
      return <Text key={key} className="text-title-3 text-foreground">{inlines(node.children)}</Text>;
    case "h3":
    case "h4":
      return <Text key={key} className="text-headline text-foreground">{inlines(node.children)}</Text>;
    case "ul":
    case "ol":
      return (
        <View key={key} className="gap-1">
          {node.children
            .filter((child): child is Element => child.type === "tag" && child.name === "li")
            .map((item, index) => (
              <View key={index} className="flex-row gap-2 pl-1">
                <Text className="text-body text-muted-foreground">{node.name === "ol" ? `${index + 1}.` : "•"}</Text>
                <View className="flex-1">{blocks(item.children)}</View>
              </View>
            ))}
        </View>
      );
    case "blockquote":
      return (
        <View key={key} className="border-l-2 border-border pl-3">
          {blocks(node.children)}
        </View>
      );
    case "pre":
      return (
        <Text key={key} className="rounded-md bg-muted p-2 font-mono text-footnote text-foreground">
          {textOf(node)}
        </Text>
      );
    case "hr":
      return <View key={key} className="h-px bg-border" />;
    case "table":
      // A table on a phone is its rows, one line each.
      return (
        <View key={key} className="gap-1">
          {rows(node).map((cells, index) => (
            <Text key={index} className={`text-callout text-foreground ${index === 0 ? "font-semibold" : ""}`}>
              {cells.join(" · ")}
            </Text>
          ))}
        </View>
      );
    default:
      return (
        <Text key={key} className="text-body text-foreground">
          {inlines(node.children)}
        </Text>
      );
  }
}

function inlines(nodes: ChildNode[]): ReactNode[] {
  return nodes.map((node, index) => {
    if (node.type === "text") return decodeEntities(node.data);
    if (node.type !== "tag") return null;
    const children = inlines(node.children);
    switch (node.name) {
      case "br":
        return "\n";
      case "strong":
      case "b":
        return <Text key={index} className="font-semibold">{children}</Text>;
      case "em":
      case "i":
        return <Text key={index} className="italic">{children}</Text>;
      case "u":
        return <Text key={index} className="underline">{children}</Text>;
      case "s":
        return <Text key={index} className="line-through">{children}</Text>;
      case "code":
        return <Text key={index} className="font-mono text-footnote">{children}</Text>;
      case "a": {
        const href = node.attribs.href;
        return (
          <Text
            key={index}
            accessibilityRole="link"
            className="text-brand-ink underline"
            onPress={href && /^(https?:|mailto:|tel:)/.test(href) ? () => void Linking.openURL(href) : undefined}
          >
            {children}
          </Text>
        );
      }
      default:
        return <Text key={index}>{children}</Text>;
    }
  });
}

function rows(table: Element): string[][] {
  const out: string[][] = [];
  const walk = (node: ChildNode) => {
    if (node.type !== "tag") return;
    if (node.name === "tr") {
      out.push(node.children.filter((cell): cell is Element => cell.type === "tag").map((cell) => textOf(cell).trim()));
      return;
    }
    node.children.forEach(walk);
  };
  table.children.forEach(walk);
  return out;
}

function textOf(node: ChildNode): string {
  if (node.type === "text") return decodeEntities(node.data);
  if (node.type !== "tag") return "";
  if (node.name === "br") return "\n";
  return node.children.map(textOf).join("");
}
