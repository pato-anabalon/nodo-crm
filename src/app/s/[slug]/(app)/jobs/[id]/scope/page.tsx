import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { RichText } from "@/components/rich-text";
import { richTextToPlain } from "@/lib/rich-text";
import { requireJobContext } from "@/modules/jobs/access";
import { jobScope } from "@/modules/jobs/service";

export async function generateMetadata() {
  const t = await getTranslations("jobs.scope");
  return { title: t("title") };
}

/**
 * What the job was quoted for: read-only, and copyable so a line can become a
 * to-do or the start of a Message Board post without being retyped.
 */
export default async function JobScopePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, job } = await requireJobContext(id);
  const [t, items] = await Promise.all([getTranslations("jobs.scope"), jobScope(ctx, job.id)]);

  // Each line as the plain text a to-do title wants, and the formatted version an editor keeps.
  const entries = items.map((item) => {
    const body = richTextToPlain(item.body).trim();
    return {
      ...item,
      text: body ? `${item.title}\n\n${body}` : item.title,
      html: `<p><strong>${escapeHtml(item.title)}</strong></p>${item.body ?? ""}`,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href={`/jobs/${job.id}`} aria-label={t("backToJob", { name: job.name })}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="truncate text-sm text-muted-foreground">{job.name}</p>
        </div>
        {entries.length > 0 ? (
          <CopyButton
            label={t("copyAll")}
            copiedLabel={t("copied")}
            text={entries.map((entry) => entry.text).join("\n\n---\n\n")}
            html={entries.map((entry) => entry.html).join("<hr>")}
          />
        ) : null}
      </div>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm italic text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{t("intro")}</p>
          <ol className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 font-semibold">{entry.title}</h2>
                  <CopyButton size="icon" variant="ghost" label={t("copy")} copiedLabel={t("copied")} text={entry.text} html={entry.html} />
                </div>
                <RichText html={entry.body} className="mt-2 text-sm text-muted-foreground" />
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
