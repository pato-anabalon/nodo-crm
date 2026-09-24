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
 * confirmation. What does deserve saying out loud is that a resend invalidates
 * the link the customer already has, which is not obvious from the word "send".
 */
export function ShareCard({
  revoked,
  expiresLabel,
  previewHref,
  canManage,
  onResend,
  onRevoke,
}: {
  revoked: boolean;
  expiresLabel: string | null;
  previewHref: string;
  canManage: boolean;
  onResend: () => Promise<QuoteActionState>;
  onRevoke: () => Promise<QuoteActionState>;
}) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const t = useTranslations("quotes.share");

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
          {revoked ? t("revokedState") : t("sentState")}
        </p>

        {!revoked && expiresLabel ? (
          <p className="text-xs text-muted-foreground">{t("expiresOn", { date: expiresLabel })}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={previewHref}>
              <ExternalLink className="size-4" />
              {t("preview")}
            </Link>
          </Button>

          {canManage ? (
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
          {canManage ? t("resendHint") : t("previewHint")}
        </p>
      </CardContent>
    </Card>
  );
}
