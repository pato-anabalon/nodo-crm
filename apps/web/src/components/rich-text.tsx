import { sanitizeRichText, type RichTextProfile } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

/**
 * Saved rich text, on its way to the screen.
 *
 * Every place that displays it goes through here. The quote panel used to print
 * it as plain text while the portal rendered it, so the team read `<p>` tags
 * where the customer read a formatted scope of work — one component is what
 * stops the two drifting apart again.
 *
 * It is sanitised on save as well. Doing it again here is deliberate and not
 * redundant: the stored value may have arrived by another route, and this is the
 * last point before it becomes markup.
 */
export function RichText({
  html,
  className,
  profile = "basic",
}: {
  html: string | null;
  className?: string;
  /** `full` for the Message Board; the quote's stays `basic`. */
  profile?: RichTextProfile;
}) {
  const clean = sanitizeRichText(html, profile);
  if (!clean) return null;

  return (
    <div className={cn("rich-text", className)} dangerouslySetInnerHTML={{ __html: clean }} />
  );
}
