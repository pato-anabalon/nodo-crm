import Link from "next/link";
import { ArrowLeft, MessageSquare, Paperclip, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { elapsedLabel } from "@/lib/elapsed-label";
import { requireJobContext } from "@/modules/jobs/access";
import { PersonAvatar, personName } from "@/modules/jobs/avatars";
import { postCategoryName } from "@/modules/jobs/categories";
import { listPostCategories, listPosts, myDrafts } from "@/modules/jobs/board/service";

export async function generateMetadata() {
  const t = await getTranslations("jobs.board");
  return { title: t("title") };
}

export default async function MessageBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { ctx, job } = await requireJobContext(id, "messages.read");
  const [t, tElapsed] = await Promise.all([getTranslations("jobs.board"), getTranslations("common.elapsed")]);

  const categories = await listPostCategories(ctx);
  // An id that isn't one of the company's categories reads as "all" rather than as an empty board.
  const categoryId =
    typeof query.category === "string" && categories.some((c) => c.id === query.category) ? query.category : null;
  const [posts, drafts] = await Promise.all([listPosts(ctx, job.id, categoryId), myDrafts(ctx, job.id)]);

  const ago = (date: Date) => elapsedLabel(date, tElapsed, ctx.company.formatLocale, ctx.company.timezone);
  const name = (category: { key: string | null; name: string | null }) => postCategoryName(category, t);
  const base = `/jobs/${job.id}/messages`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href={`/jobs/${job.id}`} aria-label={t("backToJob", { name: job.name })}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
            <p className="truncate text-sm text-muted-foreground">{job.name}</p>
          </div>
        </div>
        {can(ctx, "messages.create") ? (
          <Button asChild>
            <Link href={`${base}/new`}>
              <Plus className="size-4" />
              {t("newPost")}
            </Link>
          </Button>
        ) : null}
      </div>

      {drafts.length > 0 ? (
        <section className="space-y-2 rounded-lg border border-dashed p-4">
          <h2 className="text-sm font-semibold">{t("yourDrafts", { count: drafts.length })}</h2>
          <ul className="space-y-1 text-sm">
            {drafts.map((draft) => (
              <li key={draft.id} className="flex flex-wrap items-baseline gap-x-2">
                <Link href={`${base}/${draft.id}`} className="font-medium hover:underline">
                  {draft.title}
                </Link>
                <span className="text-xs text-muted-foreground">{t("draftSaved", { when: ago(draft.updatedAt) })}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {categories.length > 0 ? (
        <nav aria-label={t("filterLabel")} className="flex flex-wrap gap-1.5">
          {[null, ...categories].map((category) => {
            const active = (category?.id ?? null) === categoryId;
            return (
              <Link
                key={category?.id ?? "all"}
                href={category ? `${base}?category=${category.id}` : base}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                  active && "border-foreground/30 bg-muted text-foreground",
                )}
              >
                {category ? `${category.emoji} ${name(category)}` : t("allCategories")}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {posts.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm italic text-muted-foreground">
          {categoryId ? t("emptyCategory") : can(ctx, "messages.create") ? t("emptyCanPost") : t("empty")}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {posts.map((post) => (
            <li key={post.id}>
              <Link href={`${base}/${post.id}`} className="flex gap-3 p-4 transition-colors hover:bg-accent/40">
                {post.author ? <PersonAvatar person={post.author} /> : null}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    {post.category ? (
                      <span className="text-xs text-muted-foreground">
                        {post.category.emoji} {name(post.category)}
                      </span>
                    ) : null}
                    <span className="font-semibold">{post.title}</span>
                  </p>
                  {post.excerpt ? <p className="line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p> : null}
                  <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    <span>
                      {post.author ? personName(post.author) : t("someone")} · {post.publishedAt ? ago(post.publishedAt) : null}
                    </span>
                    {post._count.comments > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="size-3.5" />
                        {post._count.comments}
                      </span>
                    ) : null}
                    {post._count.files > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Paperclip className="size-3.5" />
                        {post._count.files}
                      </span>
                    ) : null}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
