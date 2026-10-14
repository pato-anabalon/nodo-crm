import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { requireJobContext } from "@/modules/jobs/access";
import { canTouch } from "@/modules/jobs/rules";
import { postCategoryName } from "@/modules/jobs/categories";
import { jobUploadPrefix } from "@/modules/jobs/files";
import { updatePostAction } from "@/modules/jobs/board/actions";
import { getPost, listPostCategories, otherMembers } from "@/modules/jobs/board/service";
import { PostForm } from "@/modules/jobs/board/post-form";
import { categoryLabel, toAttachment } from "@/modules/jobs/board/view";

export async function generateMetadata() {
  const t = await getTranslations("jobs.board");
  return { title: t("editPost") };
}

export default async function EditPostPage({ params }: { params: Promise<{ id: string; postId: string }> }) {
  const { id, postId } = await params;
  const { ctx, job } = await requireJobContext(id, "messages.update");
  if (!can(ctx, "messages.read")) notFound();
  const post = await getPost(ctx, job.id, postId);
  // Somebody else's post without `jobs.moderate` is not theirs to open here.
  if (!post || !canTouch(ctx.user.id, ctx.permissions, "messages.update", post.authorId)) notFound();

  const t = await getTranslations("jobs.board");
  const [categories, people] = await Promise.all([listPostCategories(ctx), otherMembers(ctx, job.id)]);
  const back = `/jobs/${job.id}/messages/${post.id}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href={back} aria-label={t("backToPost")}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{post.publishedAt ? t("editPost") : t("editDraft")}</h1>
          <p className="truncate text-sm text-muted-foreground">{job.name}</p>
        </div>
      </div>

      <PostForm
        action={updatePostAction.bind(null, post.id)}
        jobId={job.id}
        prefix={jobUploadPrefix(ctx.company.id, job.id)}
        categories={categories.map((c) => ({ value: c.id, label: categoryLabel(c, postCategoryName(c, t)) }))}
        people={people}
        defaults={{ title: post.title, body: post.body, categoryId: post.category?.id ?? null }}
        existingFiles={post.files.map((file) => toAttachment(file, ctx.company.formatLocale))}
        published={Boolean(post.publishedAt)}
        cancelHref={back}
      />
    </div>
  );
}
