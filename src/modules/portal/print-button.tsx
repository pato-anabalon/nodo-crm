import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Downloads the PDF, rather than opening the browser's print dialog.
 *
 * A plain link: the route behind `href` renders this same page with Chromium
 * and replies with `Content-Disposition: attachment`, which is what makes the
 * browser save the file on its own instead of showing it. No "use client" and
 * no fetch-and-blob dance — a navigation already does exactly this.
 */
export function PrintButton({ label, href }: { label: string; href: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className="no-print -ml-2">
      <a href={href} download>
        <Download className="size-4" />
        {label}
      </a>
    </Button>
  );
}
