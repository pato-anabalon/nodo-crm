import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { RichText } from "@/components/rich-text";
import { can } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { richTextToPlain } from "@/lib/rich-text";
import { requireJobContext } from "@/modules/jobs/access";
import { addScopeItemAction, deleteScopeItemAction, updateScopeItemAction } from "@/modules/jobs/scope-actions";
import { AddScopeLine, ScopeLine } from "@/modules/jobs/scope-editor";
import { scopeHistory, type ScopeSnapshot } from "@/modules/jobs/scope-edits";
import { jobScope } from "@/modules/jobs/service";

export async function generateMetadata() {
  const t = await getTranslations("jobs.scope");
  return { title: t("title") };
}

/**
 * What the job was quoted for, copyable so a line can become a to-do or the
 * start of a Message Board post without being retyped. With `scope.update`
 * its lines are edited, added and deleted here, and the history under them
 * says who changed what, and what it said before.
 */
export default async function JobScopePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, job } = await requireJobContext(id, "scope.read");
  const [t, items, history] = await Promise.all([getTranslations("jobs.scope"), jobScope(ctx, job.id), scopeHistory(ctx, job.id)]);
  const canEdit = can(ctx, "scope.update");
  const { formatLocale, timezone } = ctx.company;
  const who = (person: { name: string | null; email: string } | null) => (person ? (person.name ?? person.email) : t("someone"));
  const when = (date: Date) => formatDateTime(date, formatLocale, timezone);

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
        <p className="rounded-lg border border-dashed p-8 text-center text-sm italic text-muted-foreground">
          {canEdit ? t("emptyEditable") : t("empty")}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{canEdit ? t("introEditable") : t("intro")}</p>
          <ol className="space-y-3">
            {entries.map((entry) => (
              <ScopeLine
                key={entry.id}
                title={entry.title}
                body={entry.body}
                view={<RichText html={entry.body} className="mt-2 text-sm text-muted-foreground" />}
                edited={entry.editedAt ? t("editedBy", { person: who(entry.editedBy), date: when(entry.editedAt) }) : null}
                copy={<CopyButton size="icon" variant="ghost" label={t("copy")} copiedLabel={t("copied")} text={entry.text} html={entry.html} />}
                update={canEdit ? updateScopeItemAction.bind(null, job.id, entry.id) : undefined}
                remove={canEdit ? deleteScopeItemAction.bind(null, job.id, entry.id) : undefined}
              />
            ))}
          </ol>
        </>
      )}

      {canEdit ? <AddScopeLine action={addScopeItemAction.bind(null, job.id)} /> : null}

      {history.length > 0 ? (
        <section className="space-y-3 border-t pt-6">
          <h2 className="font-semibold">{t("history")}</h2>
          <ol className="space-y-4 text-sm">
            {history.map((change) => {
              const before = change.before as ScopeSnapshot | null;
              const after = change.after as ScopeSnapshot | null;
              return (
                <li key={change.id} className="space-y-1">
                  <p>
                    <span className="font-medium">
                      {t("historyLine", { person: who(change.author), kind: change.kind, title: (after ?? before)?.title ?? "" })}
                    </span>{" "}
                    <span className="text-muted-foreground">· {when(change.createdAt)}</span>
                  </p>
                  {change.kind === "EDITED" && before ? (
                    <p className="text-muted-foreground">
                      <span className="line-through">{snapshotText(before)}</span>
                      <br />
                      {after ? snapshotText(after) : null}
                    </p>
                  ) : change.kind === "DELETED" && before ? (
                    <p className="text-muted-foreground line-through">{snapshotText(before)}</p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

/** A line as one sentence for the history: its title, and its write-up cut short. */
function snapshotText(line: ScopeSnapshot): string {
  const body = richTextToPlain(line.body).trim().replace(/\s+/g, " ");
  const short = body.length > 240 ? `${body.slice(0, 240)}…` : body;
  return short ? `${line.title} — ${short}` : line.title;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
