"use client";

import { useOptimistic, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { NotificationKind } from "@/generated/prisma/enums";
import { NOTIFICATION_KINDS } from "./preferences";
import { setNotificationPreferenceAction } from "./actions";

/**
 * Each person's own notices, for the company they're currently in.
 *
 * The toggle updates optimistically: waiting on a round trip to tick a checkbox
 * makes the screen feel broken, and the worst case is the box snapping back.
 */
export function NotificationPreferencesForm({
  preferences,
}: {
  preferences: Record<NotificationKind, boolean>;
}) {
  const t = useTranslations("notificationSettings");
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(preferences);

  function toggle(kind: NotificationKind, enabled: boolean) {
    startTransition(async () => {
      setOptimistic({ ...optimistic, [kind]: enabled });
      const result = await setNotificationPreferenceAction(kind, enabled);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {NOTIFICATION_KINDS.map((kind) => (
          <label key={kind} className="flex items-start gap-3">
            <Checkbox
              checked={optimistic[kind]}
              disabled={pending}
              onCheckedChange={(checked) => toggle(kind, checked === true)}
              className="mt-0.5"
            />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">{t(`kinds.${kind}`)}</span>
              <span className="block text-xs text-muted-foreground">
                {t(`kinds.${kind}_hint`)}
              </span>
            </span>
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
