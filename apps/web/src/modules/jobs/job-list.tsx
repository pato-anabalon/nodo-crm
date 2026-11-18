"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvatarStack, type Person } from "./avatars";
import { jobsHref, matchesJobName, normaliseJobQuery, SEARCHED_ON, type JobListShow } from "./search";

export type JobListItem = {
  id: string;
  name: string;
  description: string | null;
  /** Its colour on the Lineup, so the card and the bar read as the same job. */
  colour: string;
  /** Already translated; null for an active job, which says nothing. */
  statusLabel: string | null;
  people: Person[];
};

/** The query as the address says it, which is where both halves read it from. */
function useJobQuery() {
  return normaliseJobQuery(useSearchParams().get("q"));
}

/**
 * The search and the two tabs. On In progress the search filters as it is
 * typed and only rewrites the address — nothing goes back to the server, so
 * a reload or a shared link finds the same list. On Finished it is a plain
 * GET form, because that list is searched by the database.
 */
export function JobListControls({ show }: { show: JobListShow }) {
  const t = useTranslations("jobs");
  const tCommon = useTranslations("common");
  const query = useJobQuery();
  const [value, setValue] = useState(query ?? "");
  const inBrowser = SEARCHED_ON[show] === "browser";
  const inputId = useId();

  return (
    <div className="space-y-3">
      <form
        className="flex w-full items-center gap-2 sm:w-auto"
        onSubmit={inBrowser ? (event) => event.preventDefault() : undefined}
      >
        {show === "done" ? <input type="hidden" name="show" value="done" /> : null}
        {/* Named on screen: on In progress there is no button to say this box filters. */}
        <Label htmlFor={inputId} className="shrink-0">
          {t("searchLabel")}
        </Label>
        <Input
          id={inputId}
          type="search"
          name="q"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (inBrowser) window.history.replaceState(null, "", jobsHref(show, normaliseJobQuery(event.target.value)));
          }}
          placeholder={t("searchPlaceholder")}
          className="sm:w-64"
        />
        {inBrowser ? null : (
          <Button type="submit" variant="secondary">
            {tCommon("filter")}
          </Button>
        )}
      </form>
      <div className="flex flex-wrap gap-2">
        {(["active", "done"] as const).map((tab) => (
          <Button key={tab} asChild size="sm" variant={show === tab ? "secondary" : "ghost"}>
            <Link href={jobsHref(tab, query)}>{t(`show.${tab}`)}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * The cards. Filtering here as well on Finished changes nothing — the
 * database already answered for the same query — so the list doesn't need to
 * know which tab searched it.
 */
export function JobCards({ jobs, show }: { jobs: JobListItem[]; show: JobListShow }) {
  const t = useTranslations("jobs");
  const query = useJobQuery();
  const shown = jobs.filter((job) => matchesJobName(job.name, query));

  if (shown.length === 0) {
    return (
      <p className="text-sm italic text-muted-foreground">
        {query ? t("emptySearch", { q: query }) : show === "done" ? t("emptyDone") : t("empty")}
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 content-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {shown.map((job) => (
        <li key={job.id}>
          {/* The job's Lineup colour washes in from the top right and is gone
              by the middle, mixed into the card rather than laid on it: the
              title starts at the left and the details below it stay on plain
              card, so no text loses contrast to the tint. Stronger in dark,
              where the same share of a colour reads fainter. On hover a glow
              of the same colour drifts across it (`job-card-glow`). */}
          <Link
            href={`/jobs/${job.id}`}
            style={{ "--job": job.colour } as CSSProperties}
            className="job-card-glow flex h-full flex-col gap-2 rounded-xl border bg-card bg-[linear-gradient(to_bottom_left,color-mix(in_oklab,var(--job)_22%,transparent),transparent_60%)] p-4 transition-colors hover:border-[color-mix(in_oklab,var(--job)_50%,transparent)] hover:bg-accent/40 dark:bg-[linear-gradient(to_bottom_left,color-mix(in_oklab,var(--job)_35%,transparent),transparent_65%)]"
          >
            <span className="line-clamp-2 font-semibold leading-snug">{job.name}</span>
            {job.description ? (
              <span className="line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">{job.description}</span>
            ) : null}
            <span className="mt-auto flex items-center justify-between gap-2 pt-2">
              <AvatarStack people={job.people} />
              {job.statusLabel ? <span className="text-xs text-muted-foreground">{job.statusLabel}</span> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
