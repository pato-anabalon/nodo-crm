"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ReviewSource } from "@/generated/prisma/enums";
import { deleteReviewAction, saveReviewAction, type SettingsState } from "./actions";

export type ReviewRow = {
  id: string;
  author: string;
  rating: number;
  body: string;
  source: ReviewSource;
  sourceUrl: string | null;
  featured: boolean;
};

export function ReviewsManager({
  reviews,
  canManage,
}: {
  reviews: ReviewRow[];
  canManage: boolean;
}) {
  const t = useTranslations("settings.reviews");
  const [editing, setEditing] = useState<ReviewRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">{t("whyManual")}</p>

      {canManage && !adding && !editing ? (
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          {t("add")}
        </Button>
      ) : null}

      {adding || editing ? (
        <ReviewForm
          review={editing}
          onDone={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      ) : null}

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li key={review.id} className="space-y-2 rounded-lg border bg-background p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Stars rating={review.rating} />
                <span className="text-sm font-medium">{review.author}</span>
                <Badge variant="secondary">{t(`sources.${review.source}`)}</Badge>
                {!review.featured ? <Badge variant="outline">—</Badge> : null}

                {canManage ? (
                  <span className="ml-auto flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(review)}>
                      <Pencil className="size-4" />
                      {t("edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${t("delete")} ${review.author}`}
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await deleteReviewAction(review.id);
                          if (result.error) toast.error(result.error);
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </span>
                ) : null}
              </div>

              <p className="text-sm text-muted-foreground">{review.body}</p>

              {review.sourceUrl ? (
                <a
                  href={review.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-xs underline underline-offset-2"
                >
                  {review.sourceUrl}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewForm({ review, onDone }: { review: ReviewRow | null; onDone: () => void }) {
  const t = useTranslations("settings.reviews");
  const tCommon = useTranslations("common");
  const tSettings = useTranslations("settings");
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    saveReviewAction.bind(null, review?.id ?? null),
    {},
  );

  useEffect(() => {
    if (state.message) {
      toast.success(state.message);
      onDone();
    }
    if (state.error) toast.error(state.error);
  }, [state, onDone]);

  const errors = state.fieldErrors ?? {};

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{review ? t("edit") : t("add")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="author">{t("author")}</Label>
              <Input id="author" name="author" required defaultValue={review?.author} />
              {errors.author ? (
                <p className="text-sm text-destructive">{errors.author[0]}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="rating">{t("rating")}</Label>
              <NativeSelect
                id="rating"
                name="rating"
                defaultValue={String(review?.rating ?? 5)}
                options={[5, 4, 3, 2, 1].map((value) => ({
                  value: String(value),
                  label: "★".repeat(value),
                }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">{t("body")}</Label>
            <Textarea id="body" name="body" rows={4} required defaultValue={review?.body} />
            {errors.body ? <p className="text-sm text-destructive">{errors.body[0]}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="source">{t("source")}</Label>
              <NativeSelect
                id="source"
                name="source"
                defaultValue={review?.source ?? ReviewSource.GOOGLE}
                options={Object.values(ReviewSource).map((source) => ({
                  value: source,
                  label: t(`sources.${source}`),
                }))}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sourceUrl">{t("sourceUrl")}</Label>
              <Input
                id="sourceUrl"
                name="sourceUrl"
                type="url"
                defaultValue={review?.sourceUrl ?? ""}
                placeholder="https://"
              />
              {errors.sourceUrl ? (
                <p className="text-sm text-destructive">{errors.sourceUrl[0]}</p>
              ) : null}
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm">
            <Checkbox name="featured" defaultChecked={review?.featured ?? true} />
            {t("featured")}
          </label>

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? tSettings("saving") : tSettings("save")}
            </Button>
            <Button type="button" variant="ghost" onClick={onDone}>
              {tCommon("cancel")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Stars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, rating));
  return (
    <span className="flex gap-0.5" aria-label={`${filled}/5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          aria-hidden
          className={index < filled ? "size-3.5 fill-current" : "size-3.5 text-muted-foreground/30"}
        />
      ))}
    </span>
  );
}
