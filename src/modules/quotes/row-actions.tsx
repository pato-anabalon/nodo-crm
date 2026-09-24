"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Copy, Eye, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { duplicateQuoteAction } from "@/modules/quote-templates/actions";

/**
 * The two things worth doing to a quote without opening it.
 *
 * **Duplicate** is the one that genuinely belongs in a list: "quote this like
 * that one" is decided while looking down the list, not from inside a quote.
 * **View as customer** answers a question that occurs right there, and writes
 * nothing.
 *
 * Deliberately nothing else. Sending, revoking and deleting all reach a real
 * customer or destroy something, and in a list the row you think you are on is
 * not always the row you are on. Those keep the quote's own page, where you can
 * see which one you are acting on before you act.
 */
export function QuoteRowActions({ quoteId, title }: { quoteId: string; title: string }) {
  const t = useTranslations("quotes.rowActions");
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={t("open", { title })}
          disabled={pending}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => startTransition(() => duplicateQuoteAction(quoteId))}
        >
          <Copy className="size-4" />
          {t("duplicate")}
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href={`/quotes/${quoteId}/preview`}>
            <Eye className="size-4" />
            {t("preview")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
