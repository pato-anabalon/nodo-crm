"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QuoteActionState } from "./actions";

/**
 * What the team can do with the customer's link once the quote has gone out.
 *
 * Revoking is reversible — sending again reopens it — so neither button asks for
 * confirmation. What does deserve saying out loud is what a resend does to the
 * link: the new email carries a link of its own and the ones already sent go on
 * working, which the word "send" alone doesn't tell anybody.
 *
 * Once the quote has run out there is nothing left to do with the link but
 * look through it: resending would hand out a way into a quote nobody can
 * accept, and the customer coming back to read it is what tells the team to
 * ring them, so closing it would only lose that.
 */
export function ShareCard({
  revoked,
  ranOut,
  previewHref,
  canManage,
  onResend,
  onRevoke,
}: {
  revoked: boolean;
  /** The quote expired: only "View as customer" is left. */
  ranOut: boolean;
  previewHref: string;
  canManage: boolean;
  onResend: () => Promise<QuoteActionState>;
  onRevoke: () => Promise<QuoteActionState>;
}) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const t = useTranslations("quotes.share");
  const manage = canManage && !ranOut;

  function run(label: string, fn: () => Promise<QuoteActionState>) {
    setBusy(label);
    startTransition(async () => {
      const result = await fn();
      if (result.error) toast.error(result.error);
      else if (result.message) toast.success(result.message);
      setBusy(null);
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {revoked ? t("revokedState") : ranOut ? t("expiredState") : t("sentState")}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={previewHref}>
              <ExternalLink className="size-4" />
              {t("preview")}
            </Link>
          </Button>

          {manage ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => run("resend", onResend)}
                disabled={pending}
              >
                {busy === "resend" ? `${t("resend")}…` : t("resend")}
              </Button>

              {!revoked ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => run("revoke", onRevoke)}
                  disabled={pending}
                >
                  {busy === "revoke" ? `${t("revoke")}…` : t("revoke")}
                </Button>
              ) : null}
            </>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          {manage ? t("resendHint") : t("previewHint")}
        </p>
      </CardContent>
    </Card>
  );
}
