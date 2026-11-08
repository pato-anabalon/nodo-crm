"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Puts text on the clipboard. `html`, when given, goes beside it as a second
 * format: pasted into a plain field it arrives as `text`, pasted into an editor
 * it keeps its bold and its lists. Both come already made from the server, so
 * the sanitiser stays out of the browser's bundle.
 */
export function CopyButton({
  text,
  html,
  label,
  copiedLabel,
  variant = "outline",
  size = "sm",
}: {
  text: string;
  html?: string | null;
  label: string;
  copiedLabel: string;
  variant?: "outline" | "ghost";
  size?: "sm" | "icon";
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (html && typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([text], { type: "text/plain" }),
            "text/html": new Blob([html], { type: "text/html" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      toast.success(copiedLabel);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access refused (an insecure origin, a denied permission).
      toast.error(label);
    }
  }

  return (
    <Button type="button" variant={variant} size={size} onClick={copy} aria-label={size === "icon" ? label : undefined}>
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {size === "icon" ? <span className="sr-only">{label}</span> : copied ? copiedLabel : label}
    </Button>
  );
}
