"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmButton } from "@/components/confirm-button";
import { useActionToast } from "@/lib/use-action-toast";
import type { JobActionState } from "./actions";

export type TradeRow = { id: string; name: string; people: number };

/**
 * The company's trades. Added one at a time and checked on the way in, like
 * every other list in settings. Removing one only takes the label off people;
 * it asks first because the people it named are the cost.
 */
export function TradesManager({
  trades,
  canManage,
  onAdd,
  onDelete,
}: {
  trades: TradeRow[];
  canManage: boolean;
  onAdd: (state: JobActionState, formData: FormData) => Promise<JobActionState>;
  onDelete: (id: string) => Promise<JobActionState>;
}) {
  const t = useTranslations("trades");
  const [state, formAction, adding] = useActionState(onAdd, {});
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  useActionToast(state);

  useEffect(() => {
    if (state.message) formRef.current?.reset();
  }, [state]);

  return (
    <Card>
      <CardContent className="space-y-4">
        {canManage ? (
          <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1 space-y-2">
              <Label htmlFor="trade-name">{t("name")}</Label>
              <Input id="trade-name" name="name" placeholder={t("namePlaceholder")} maxLength={60} required />
              {state.fieldErrors?.name ? <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p> : null}
            </div>
            <Button type="submit" disabled={adding}>
              {t("add")}
            </Button>
          </form>
        ) : null}

        {trades.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {trades.map((trade) => (
              <li key={trade.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="truncate text-sm">{trade.name}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t("people", { count: trade.people })}</span>
                  {canManage ? (
                    <ConfirmButton
                      trigger={
                        <Button variant="ghost" size="icon" disabled={pending} aria-label={t("delete")}>
                          <Trash2 className="size-4" />
                        </Button>
                      }
                      title={t("deleteTitle", { name: trade.name })}
                      description={t("deleteBody", { name: trade.name })}
                      confirmLabel={t("delete")}
                      onConfirm={() =>
                        startTransition(async () => {
                          const result = await onDelete(trade.id);
                          if (result.error) toast.error(result.error);
                          else if (result.message) toast.success(result.message);
                        })
                      }
                    />
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
