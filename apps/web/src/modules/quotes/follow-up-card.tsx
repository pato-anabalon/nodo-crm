"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/confirm-button";
import type { QuoteActionState } from "./actions";
import type { ManualFollowUp } from "./follow-up";

/**
 * Chasing the customer now rather than on the sweep's calendar.
 *
 * Only on a quote that can still be followed up, and only the next one: the
 * second appears once the first has gone, whether a person or the sweep sent
 * it. It asks first and names who will get it — this one lands in a
 * customer's inbox and there's no taking it back.
 */
export function FollowUpCard({
  next,
  firstSent,
  recipients,
  onSend,
}: {
  next: ManualFollowUp;
  /** When the first went out, already formatted; null while it hasn't. */
  firstSent: string | null;
  /** Everybody it goes to, as one phrase ("Ana and Bruno"). */
  recipients: string;
  onSend: () => Promise<QuoteActionState>;
}) {
  const t = useTranslations("quotes.followUps");
  const [pending, startTransition] = useTransition();
  const first = next === "FIRST_FOLLOW_UP";
  const label = first ? t("sendFirst") : t("sendSecond");

  function send() {
    startTransition(async () => {
      const result = await onSend();
      if (result.error) toast.error(result.error);
      else if (result.message) toast.success(result.message);
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="space-y-2 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <dt>{t("first")}</dt>
            <dd className="text-muted-foreground">
              {firstSent ? t("sentOn", { date: firstSent }) : t("notSent")}
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt>{t("second")}</dt>
            <dd className="text-muted-foreground">{t("notSent")}</dd>
          </div>
        </dl>

        <ConfirmButton
          trigger={
            <Button size="sm" variant="outline" disabled={pending}>
              <Send className="size-4" />
              {pending ? `${label}…` : label}
            </Button>
          }
          title={t("confirmTitle", { kind: next })}
          description={t("confirmBody", { recipients })}
          confirmLabel={t("confirm")}
          confirmVariant="default"
          onConfirm={send}
          disabled={pending}
        />

        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </CardContent>
    </Card>
  );
}
