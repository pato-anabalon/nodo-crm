"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/confirm-button";
import type { TeamState } from "./actions";

/**
 * Deleting a profile the company made. Asks first and names the profile: the one
 * on screen is not always the one meant, and there is no undoing it.
 *
 * The action redirects to the list on success, so only a refusal comes back here.
 */
export function DeleteRoleButton({
  name,
  action,
}: {
  name: string;
  action: () => Promise<TeamState>;
}) {
  const t = useTranslations("team.profiles");
  const [pending, startTransition] = useTransition();

  return (
    <ConfirmButton
      disabled={pending}
      title={t("deleteTitle", { name })}
      description={t("deleteBody", { name })}
      confirmLabel={t("delete")}
      onConfirm={() =>
        startTransition(async () => {
          const result = await action();
          if (result?.error) toast.error(result.error);
        })
      }
      trigger={
        <Button variant="outline" size="sm" disabled={pending}>
          <Trash2 className="size-4" />
          {t("delete")}
        </Button>
      }
    />
  );
}
