"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban, ExternalLink, Power } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCard, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmButton } from "@/components/confirm-button";
import { ActivateDialog, DemoDialog } from "./access-dialogs";
import { suspendCompanyAction } from "./actions";
import { DATE, DATE_TIME } from "./dates";
import type { CompanyRow } from "./service";
import type { StatusKind } from "./status";

type Filter = "all" | "pending" | "active" | "demo" | "off";

const FILTERS: readonly Filter[] = ["all", "pending", "active", "demo", "off"];

const MATCHES: Record<Filter, (company: CompanyRow) => boolean> = {
  all: () => true,
  pending: (company) => company.status.kind === "pending",
  active: (company) => company.isActive,
  // Every demo, running or not: it is where somebody looks for the ones that lapsed.
  demo: (company) => company.isDemo,
  off: (company) => company.status.kind === "suspended" || company.status.kind === "demoEnded",
};

/** The status word is coloured and always written, so colour is never the only signal. */
const TONE: Record<StatusKind, string> = {
  pending: "text-amber-700 dark:text-amber-400",
  customer: "text-[var(--status-accepted-text)]",
  demo: "text-[var(--status-sent-text)]",
  demoEnded: "text-[var(--status-declined-text)]",
  suspended: "text-muted-foreground",
};

const WORD: Record<StatusKind, "pending" | "active" | "demo" | "demoEnded" | "suspended"> = {
  pending: "pending",
  customer: "active",
  demo: "demo",
  demoEnded: "demoEnded",
  suspended: "suspended",
};

/** "PP" for "Plaster Pro Solution": enough of a mark to tell rows apart at a glance. */
function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function CompanyList({ companies }: { companies: CompanyRow[] }) {
  const t = useTranslations("platform");
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const byFilter = Object.fromEntries(FILTERS.map((key) => [key, companies.filter(MATCHES[key]).length])) as Record<Filter, number>;
    const runningDemos = companies.filter((company) => company.status.kind === "demo").length;
    return { ...byFilter, runningDemos };
  }, [companies]);

  const visible = companies.filter(MATCHES[filter]);

  function suspend(company: CompanyRow) {
    startTransition(async () => {
      const result = await suspendCompanyAction(company.id);
      if (result.error) toast.error(result.error);
      else if (result.message) toast.success(result.message);
    });
  }

  if (companies.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("stats.total")} value={counts.all} />
        <Stat label={t("stats.active")} value={counts.active} tone="active" />
        <Stat label={t("stats.pending")} value={counts.pending} tone={counts.pending > 0 ? "waiting" : undefined} hint={counts.pending > 0 ? t("stats.waiting") : undefined} />
        <Stat label={t("stats.demos")} value={counts.runningDemos} tone={counts.runningDemos > 0 ? "demo" : undefined} />
      </div>

      <div role="tablist" aria-label={t("filters.label")} className="inline-flex flex-wrap rounded-lg border bg-card p-1 text-sm">
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 transition-colors",
              filter === key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`filters.${key}`)}
            <span className={cn("tabular-nums text-xs", filter === key ? "text-primary-foreground/80" : "text-muted-foreground")}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      <TableCard>
        <Table cards>
          <TableHeader>
            <TableRow>
              <TableHead className="h-11 pl-6">{t("columns.company")}</TableHead>
              <TableHead className="h-11">{t("columns.owner")}</TableHead>
              <TableHead className="h-11 text-right">{t("columns.users")}</TableHead>
              <TableHead className="h-11">{t("columns.createdAt")}</TableHead>
              <TableHead className="h-11">{t("columns.status")}</TableHead>
              <TableHead className="h-11 pr-6 text-right">
                <span className="sr-only">{t("columns.actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {t("emptyFilter")}
                </TableCell>
              </TableRow>
            ) : null}

            {visible.map((company) => {
              const host = hostOf(company.url);
              const { status } = company;
              return (
                <TableRow key={company.id} className={cn("h-[4.5rem] max-sm:h-auto", status.kind === "pending" && "bg-amber-500/[0.06]")}>
                  <TableCell primary className="pl-6">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary"
                      >
                        {initials(company.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="max-w-[16rem] truncate font-medium" title={company.name}>
                          {company.name}
                        </p>
                        <a
                          href={company.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                        >
                          {host}
                          <ExternalLink className="size-3" aria-hidden />
                        </a>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell label={t("columns.owner")} className="min-w-0 text-sm">
                    {company.ownerEmail ? (
                      <span className="block max-w-[20rem] min-w-0 truncate" title={company.ownerEmail}>
                        {company.ownerEmail}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell label={t("columns.users")} className="text-right text-sm tabular-nums">{company.userCount}</TableCell>

                  <TableCell label={t("columns.createdAt")} className="whitespace-nowrap text-sm text-muted-foreground" title={DATE_TIME.format(company.createdAt)}>
                    {DATE.format(company.createdAt)}
                  </TableCell>

                  <TableCell label={t("columns.status")}>
                    {/* One box, so on a phone the word and its note stay together
                        on the value side instead of becoming two flex items. */}
                    <div>
                    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium", TONE[status.kind])}>
                      <span aria-hidden className="size-2 rounded-full bg-current" />
                      {t(`status.${WORD[status.kind]}`)}
                    </span>
                    {status.kind === "demo" ? (
                      <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">
                        {t("demo.daysLeft", { days: status.daysLeft })} · {t("demo.endsOn", { date: DATE.format(status.endsAt) })}
                      </p>
                    ) : null}
                    {status.kind === "demoEnded" && status.endedAt ? (
                      <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">
                        {t("demo.ended", { date: DATE.format(status.endedAt) })}
                      </p>
                    ) : null}
                    </div>
                  </TableCell>

                  <TableCell label={t("columns.actions")} className="pr-6">
                    <div className="flex items-center justify-end gap-2">
                      {status.kind === "demo" ? (
                        <DemoDialog
                          company={company}
                          trigger={
                            <Button variant="outline" size="sm" disabled={pending} className="w-24">
                              {t("demoDialog.manage")}
                            </Button>
                          }
                        />
                      ) : null}

                      {company.isActive ? (
                        <ConfirmButton
                          trigger={
                            <Button variant="outline" size="sm" disabled={pending} className="w-28 text-destructive hover:text-destructive">
                              <Ban className="size-4" aria-hidden />
                              {t("suspend")}
                            </Button>
                          }
                          title={t("confirmSuspend.title", { company: company.name })}
                          description={t("confirmSuspend.body", { host })}
                          confirmLabel={t("confirmSuspend.confirm")}
                          onConfirm={() => suspend(company)}
                        />
                      ) : (
                        <ActivateDialog
                          company={company}
                          host={host}
                          trigger={
                            <Button size="sm" disabled={pending} className="w-28">
                              <Power className="size-4" aria-hidden />
                              {t("activate")}
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableCard>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone?: "active" | "waiting" | "demo";
  hint?: string;
}) {
  return (
    <Card className={cn("gap-1 px-5 py-4", tone === "waiting" && "border-amber-500/40 bg-amber-500/[0.06]")}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-3xl font-semibold tabular-nums",
          tone === "active" && "text-[var(--status-accepted-text)]",
          tone === "waiting" && "text-amber-700 dark:text-amber-400",
          tone === "demo" && "text-[var(--status-sent-text)]",
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}
