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
import type { JobActionState } from "../actions";

export type CategoryRow = { id: string; emoji: string; name: string; posts: number };

/**
 * The Message Board's categories. The same shape as trades: added one at a
 * time, and removing one asks first — though what it costs is only the label,
 * since the posts stay, uncategorised.
 */
export function PostCategoriesManager({
  categories,
  canManage,
  onAdd,
  onDelete,
}: {
  categories: CategoryRow[];
  canManage: boolean;
  onAdd: (state: JobActionState, formData: FormData) => Promise<JobActionState>;
  onDelete: (id: string) => Promise<JobActionState>;
}) {
  const t = useTranslations("postCategories");
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
            <div className="w-20 space-y-2">
              <Label htmlFor="category-emoji">{t("emoji")}</Label>
              <Input id="category-emoji" name="emoji" placeholder="🧱" maxLength={16} required className="text-center text-lg" />
            </div>
            <div className="min-w-48 flex-1 space-y-2">
              <Label htmlFor="category-name">{t("name")}</Label>
              <Input id="category-name" name="name" placeholder={t("namePlaceholder")} maxLength={40} required />
            </div>
            <Button type="submit" disabled={adding}>
              {t("add")}
            </Button>
            {state.fieldErrors?.emoji || state.fieldErrors?.name ? (
              <p className="w-full text-sm text-destructive">{(state.fieldErrors.name ?? state.fieldErrors.emoji)?.[0]}</p>
            ) : null}
          </form>
        ) : null}

        {categories.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {categories.map((category) => (
              <li key={category.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="truncate text-sm">
                  <span className="mr-2">{category.emoji}</span>
                  {category.name}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t("posts", { count: category.posts })}</span>
                  {canManage ? (
                    <ConfirmButton
                      trigger={
                        <Button variant="ghost" size="icon" disabled={pending} aria-label={t("delete")}>
                          <Trash2 className="size-4" />
                        </Button>
                      }
                      title={t("deleteTitle", { name: category.name })}
                      description={t("deleteBody", { count: category.posts })}
                      confirmLabel={t("delete")}
                      onConfirm={() =>
                        startTransition(async () => {
                          const result = await onDelete(category.id);
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
