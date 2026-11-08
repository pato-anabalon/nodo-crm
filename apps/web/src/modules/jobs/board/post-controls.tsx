"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/confirm-button";
import type { JobActionState } from "../actions";

/** Deleting a post takes its comments and files with it, and the question says so. */
export function DeletePostButton({ title, onDelete }: { title: string; onDelete: () => Promise<JobActionState> }) {
  const t = useTranslations("jobs.board");
  const [pending, start] = useTransition();
  return (
    <ConfirmButton
      trigger={
        <Button type="button" variant="outline" disabled={pending}>
          <Trash2 className="size-4" />
          {t("deletePost")}
        </Button>
      }
      title={t("deletePostTitle", { title })}
      description={t("deletePostBody")}
      confirmLabel={t("deletePost")}
      onConfirm={() =>
        start(async () => {
          const result = await onDelete();
          if (result?.error) toast.error(result.error);
        })
      }
    />
  );
}
