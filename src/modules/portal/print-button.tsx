"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Produces the PDF using the browser itself.
 *
 * The print stylesheet leaves the document ready for paper, so what the customer
 * saves is exactly what they see. No dependencies and no Chromium on the server;
 * in exchange, they pick the filename.
 */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="ghost" size="sm" className="no-print -ml-2" onClick={() => window.print()}>
      <Download className="size-4" />
      {label}
    </Button>
  );
}
