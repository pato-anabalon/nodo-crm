/**
 * Searching the job list by name. In progress is searched in the browser —
 * the whole list is already on the page and a company has a handful open at
 * once — while Finished, which only grows, is searched by the database.
 *
 * Both sides have to agree on what a match is, or the same query would find
 * different jobs depending on the tab: a case-insensitive "contains", the
 * same as Prisma's `contains` with `mode: "insensitive"`.
 */
export type JobListShow = "active" | "done";

/** Where each tab is searched. */
export const SEARCHED_ON: Record<JobListShow, "browser" | "database"> = { active: "browser", done: "database" };

export const MAX_JOB_QUERY = 200;

export function normaliseJobQuery(raw: unknown): string | undefined {
  const q = typeof raw === "string" ? raw.trim().slice(0, MAX_JOB_QUERY) : "";
  return q || undefined;
}

export function matchesJobName(name: string, q: string | undefined): boolean {
  if (!q) return true;
  return name.toLocaleLowerCase().includes(q.toLocaleLowerCase());
}

/**
 * Finished comes a page at a time, which is what makes searching it in the
 * database worth anything. In progress is never paged: the browser filters
 * it, and can only filter what it was given. A multiple of two and three, so
 * the grid's last row is full at every width.
 */
export const DONE_PAGE_SIZE = 24;

export function normaliseJobPage(raw: unknown): number {
  const page = typeof raw === "string" ? Number(raw) : NaN;
  return Number.isInteger(page) && page > 1 ? page : 1;
}

/** The list's own address, keeping the search when switching tabs. */
export function jobsHref(show: JobListShow, q?: string, page = 1) {
  const params = new URLSearchParams();
  if (show === "done") params.set("show", "done");
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/jobs?${query}` : "/jobs";
}
