"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Copy, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { duplicateQuoteAction, saveQuoteAsTemplateAction } from "./actions";
import { NameForm } from "./template-manager";

/**
 * What a finished quote can become: another quote, or a template.
 *
 * Both start from the same content and differ only in intent — one is for this
 * customer now, the other is for a kind of work later — which is why they sit
 * together and why naming is asked for only on the second.
 */
export function QuoteReuseCard({ quoteId, canEdit }: { quoteId: string; canEdit: boolean }) {
  const t = useTranslations("quoteTemplates.reuse");
  const [naming, setNaming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!canEdit) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => startTransition(() => duplicateQuoteAction(quoteId))}
          >
            <Copy className="size-4" />
            {pending ? t("duplicating") : t("duplicate")}
          </Button>

          {!naming ? (
            <Button variant="outline" size="sm" onClick={() => setNaming(true)}>
              <Save className="size-4" />
              {t("saveAsTemplate")}
            </Button>
          ) : null}
        </div>

        {naming ? (
          <div className="rounded-md border p-3">
            <NameForm
              action={saveQuoteAsTemplateAction.bind(null, quoteId)}
              submitLabel={t("saveAsTemplate")}
              onDone={() => setNaming(false)}
              onCancel={() => setNaming(false)}
            />
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </CardContent>
    </Card>
  );
}
