import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { requireJobContext } from "@/modules/jobs/access";
import { postCategoryName } from "@/modules/jobs/categories";
import { jobUploadPrefix } from "@/modules/jobs/files";
import { createPostAction } from "@/modules/jobs/board/actions";
import { listPostCategories, otherMembers } from "@/modules/jobs/board/service";
import { PostForm } from "@/modules/jobs/board/post-form";
import { categoryLabel } from "@/modules/jobs/board/view";

export async function generateMetadata() {
  const t = await getTranslations("jobs.board");
  return { title: t("newPost") };
}

export default async function NewPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, job } = await requireJobContext(id, "messages.create");
  if (!can(ctx, "messages.read")) notFound();
  const t = await getTranslations("jobs.board");
  const [categories, people] = await Promise.all([listPostCategories(ctx), otherMembers(ctx, job.id)]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href={`/jobs/${job.id}/messages`} aria-label={t("backToBoard")}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t("newPost")}</h1>
          <p className="truncate text-sm text-muted-foreground">{job.name}</p>
        </div>
      </div>

      <PostForm
        action={createPostAction.bind(null, job.id)}
        jobId={job.id}
        prefix={jobUploadPrefix(ctx.company.id, job.id)}
        categories={categories.map((c) => ({ value: c.id, label: categoryLabel(c, postCategoryName(c, t)) }))}
        people={people}
        published={false}
        cancelHref={`/jobs/${job.id}/messages`}
      />
    </div>
  );
}
