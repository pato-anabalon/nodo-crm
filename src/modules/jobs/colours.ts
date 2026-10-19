/**
 * A job's colour: its bar on the Lineup. A closed palette, chosen to carry
 * white text, so a job's name stays readable on its own bar; a job nobody
 * picked a colour for gets one derived from its id, so it is at least the
 * same colour every time it is drawn.
 */
export const JOB_COLOURS = [
  "#1971c2",
  "#0c8599",
  "#2b8a3e",
  "#5c940d",
  "#e8590c",
  "#c92a2a",
  "#a61e4d",
  "#862e9c",
  "#5f3dc4",
  "#495057",
] as const;

export type JobColour = (typeof JOB_COLOURS)[number];

export function isJobColour(value: unknown): value is JobColour {
  return typeof value === "string" && (JOB_COLOURS as readonly string[]).includes(value);
}

export function jobColour(job: { id: string; color: string | null }): JobColour {
  if (isJobColour(job.color)) return job.color;
  let hash = 0;
  for (const char of job.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return JOB_COLOURS[hash % JOB_COLOURS.length];
}
