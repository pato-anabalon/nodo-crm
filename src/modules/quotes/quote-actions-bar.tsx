"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { QuoteStatus } from "@/generated/prisma/enums";
import { acceptedKey, celebrate, originOf } from "@/lib/celebrate";
import type { QuoteActionState } from "./actions";

/**
 * Status-change buttons. Valid transitions are decided by the server; here we
 * only show the ones that make sense for the current status.
 */
export function QuoteActionsBar({
  quoteId,
  status,
  canSend,
  canDecide,
  onSend,
  onDecide,
}: {
  quoteId: string;
  status: QuoteStatus;
  canSend: boolean;
  canDecide: boolean;
  onSend: () => Promise<QuoteActionState>;
  onDecide: (decision: "ACCEPTED" | "REJECTED") => Promise<QuoteActionState>;
}) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const t = useTranslations("quotes");
  const tCommon = useTranslations("common");

  function run(
    label: string,
    fn: () => Promise<QuoteActionState>,
    onDone?: () => void,
  ) {
    setBusy(label);
    startTransition(async () => {
      const result = await fn();
      if (result.error) toast.error(result.error);
      else {
        if (result.message) toast.success(result.message);
        onDone?.();
      }
      setBusy(null);
    });
  }

  const showSend = canSend && status === QuoteStatus.DRAFT;
  const showDecision = canDecide && status === QuoteStatus.SENT;

  if (!showSend && !showDecision) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {showSend ? (
        <Button
          onClick={(event) => {
            // Read now, while the button is still under the pointer: by the
            // time the action resolves the bar may have re-rendered away.
            const origin = originOf(event.currentTarget);
            // Small and short: sending is routine, and this happens several
            // times a week. No key — it answers a click, so it fires every time.
            run("send", onSend, () => void celebrate({ intensity: "small", origin }));
          }}
          disabled={pending}
        >
          {busy === "send" ? t("actions.sending") : t("actions.send")}
        </Button>
      ) : null}

      {showDecision ? (
        <>
          <Button
            variant="default"
            onClick={() =>
              // Recording by hand what the customer said on the phone is the
              // same news as them clicking accept. The key is the one the page
              // uses, so revalidating into ACCEPTED can't celebrate it twice.
              run("accept", () => onDecide("ACCEPTED"), () =>
                void celebrate({ key: acceptedKey.staff(quoteId) }),
              )
            }
            disabled={pending}
          >
            {busy === "accept" ? tCommon("saving") : t("actions.accept")}
          </Button>
          <Button
            variant="outline"
            onClick={() => run("reject", () => onDecide("REJECTED"))}
            disabled={pending}
          >
            {busy === "reject" ? tCommon("saving") : t("actions.reject")}
          </Button>
        </>
      ) : null}
    </div>
  );
}
