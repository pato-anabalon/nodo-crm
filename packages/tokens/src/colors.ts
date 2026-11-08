/**
 * The colour tokens both apps draw with. The names are the web's, unchanged:
 * `apps/web/src/app/tokens.css` is generated from this file, and the app reads
 * the same values as hex through `palette()` (React Native has no OKLCH).
 *
 * `light` is the value in light mode; `dark` only where dark differs — a token
 * without one keeps its light value in both. `utility` registers it with
 * Tailwind on the web (`bg-panel`, `text-muted-foreground`); the rest are read
 * as `var(--status-sent)`.
 *
 * `--primary`, `--ring`, `--sidebar-primary*`, `--brand-ink` and `--chart-1`
 * are overwritten at runtime with the active company's colours (`brandVars`),
 * so the values here are only the fallback for when no company is resolved.
 */

export type ColorToken = { light: string; dark?: string; utility?: true };

const ink = "oklch(0.129 0.042 264.695)";
const paper = "oklch(0.984 0.003 247.858)";
const slate = "oklch(0.208 0.042 265.755)";
const mist = "oklch(0.968 0.007 247.896)";
const night = "oklch(0.279 0.041 260.031)";
const blue = "oklch(0.546 0.245 262.881)";
const line = "oklch(0.929 0.013 255.508)";
const hairline = "oklch(1 0 0 / 10%)";
const darkRing = "oklch(0.551 0.027 264.364)";

export const COLORS = {
  background: { light: "oklch(1 0 0)", dark: ink, utility: true },
  foreground: { light: ink, dark: paper, utility: true },
  card: { light: "oklch(1 0 0)", dark: slate, utility: true },
  "card-foreground": { light: ink, dark: paper, utility: true },
  popover: { light: "oklch(1 0 0)", dark: slate, utility: true },
  "popover-foreground": { light: ink, dark: paper, utility: true },
  primary: { light: blue, dark: "oklch(0.707 0.165 254.624)", utility: true },
  "primary-foreground": { light: paper, dark: slate, utility: true },
  /*
   * A step below the field beside it, so a secondary button reads as a solid
   * thing rather than as a hole in the row. It used to sit at 0.968 — all but
   * the white of the card — with no border and no shadow to give it an edge.
   */
  secondary: { light: "oklch(0.92 0.014 255.5)", dark: night, utility: true },
  "secondary-foreground": { light: slate, dark: paper, utility: true },
  muted: { light: mist, dark: night, utility: true },
  "muted-foreground": { light: "oklch(0.554 0.046 257.417)", dark: "oklch(0.704 0.04 256.788)", utility: true },
  accent: { light: mist, dark: night, utility: true },
  "accent-foreground": { light: slate, dark: paper, utility: true },
  destructive: { light: "oklch(0.577 0.245 27.325)", dark: "oklch(0.704 0.191 22.216)", utility: true },
  "destructive-foreground": { light: paper, dark: paper, utility: true },
  border: { light: line, dark: hairline, utility: true },
  /*
   * Form controls get a surface of their own, a step below the card they sit on
   * and a step below the panel: with `transparent` they took whatever was
   * behind them and a select on a white card was invisible. The border is
   * darkened to match, so the control keeps a defined edge now that the fill is
   * close to the panel it sometimes sits on directly. In dark the field sits
   * above the card rather than below it: on a dark surface a control reads as
   * raised, not as a hole.
   */
  field: { light: "oklch(0.945 0.01 255.5)", dark: night, utility: true },
  input: { light: "oklch(0.87 0.015 255.5)", dark: "oklch(1 0 0 / 15%)", utility: true },
  /*
   * The working surface behind the main pane — and only behind it. Cards, inputs
   * and menus keep `card`/`background`, so they read as sitting on top of this
   * rather than being tinted by it. In dark, a shade above the chrome and still
   * below the cards: the same three-layer stack, not an inversion of it.
   */
  panel: { light: "#f2f2f2", dark: "oklch(0.169 0.042 264.695)", utility: true },
  ring: { light: blue, dark: darkRing, utility: true },
  "chart-1": { light: "oklch(0.646 0.222 41.116)", dark: "oklch(0.488 0.243 264.376)", utility: true },
  "chart-2": { light: "oklch(0.6 0.118 184.704)", dark: "oklch(0.696 0.17 162.48)", utility: true },
  "chart-3": { light: "oklch(0.398 0.07 227.392)", dark: "oklch(0.769 0.188 70.08)", utility: true },
  "chart-4": { light: "oklch(0.828 0.189 84.429)", dark: "oklch(0.627 0.265 303.9)", utility: true },
  "chart-5": { light: "oklch(0.769 0.188 70.08)", dark: "oklch(0.645 0.246 16.439)", utility: true },
  sidebar: { light: paper, dark: slate, utility: true },
  "sidebar-foreground": { light: ink, dark: paper, utility: true },
  "sidebar-primary": { light: blue, dark: "oklch(0.488 0.243 264.376)", utility: true },
  "sidebar-primary-foreground": { light: paper, dark: paper, utility: true },
  "sidebar-accent": { light: mist, dark: night, utility: true },
  "sidebar-accent-foreground": { light: slate, dark: paper, utility: true },
  "sidebar-border": { light: line, dark: hairline, utility: true },
  "sidebar-ring": { light: blue, dark: darkRing, utility: true },

  /*
   * Quote chart colours. Independent of the brand colour on purpose: "accepted"
   * can't change meaning because a company picked a different primary. They
   * pass the same checks over a dark surface as well.
   *
   * "expired" reuses the badge's own `status-expired`, fixed at its *light*
   * value (#1f2937) in both themes rather than switching to the dark
   * variant's inverted #cbd5e1 — that one reads fine as a badge fill under
   * dark text, but simulated for deuteranopia it sits only ΔE 16.7 from
   * `quote-awaiting`'s dark grey, worse than any existing pair. The fixed
   * value stays ΔE 54+ from everything in both themes, same reasoning
   * `quote-declined` already not changing between themes follows.
   */
  "quote-accepted": { light: "#04c604", dark: "#1dd826", utility: true },
  "quote-awaiting": { light: "#9b9b9b", dark: "#aaaaaa", utility: true },
  "quote-declined": { light: "#be123c", dark: "#be123c", utility: true },
  "quote-expired": { light: "#1f2937", dark: "#1f2937", utility: true },

  /*
   * Quote status badges. A separate set from the chart colours above, because
   * the encodings differ: a badge carries its own word, so it can afford green
   * and red — 1.4 ΔE apart under deuteranopia — where a chart segment, known by
   * colour alone, cannot. All five pass AA against their own text.
   *
   * Fixed values: until now "accepted" used `bg-primary`, so its colour changed
   * with whatever brand colour a company had chosen. In dark only the two
   * neutrals move: a near-black badge on a near-black row is invisible (1.2:1),
   * so "expired" inverts to a light fill with dark text, and "draft" lifts
   * enough to separate from the row it sits on.
   */
  "status-draft": { light: "#475569", dark: "#64748b" },
  "status-draft-fg": { light: "#ffffff" },
  "status-sent": { light: "#1d4ed8" },
  "status-sent-fg": { light: "#ffffff" },
  "status-accepted": { light: "#15803d" },
  "status-accepted-fg": { light: "#ffffff" },
  "status-declined": { light: "#be123c" },
  "status-declined-fg": { light: "#ffffff" },
  "status-expired": { light: "#1f2937", dark: "#cbd5e1" },
  "status-expired-fg": { light: "#ffffff", dark: "#0f172b" },

  /*
   * The same statuses written as text rather than filled behind it.
   *
   * A separate set, not the fills reused. Those were chosen to sit under white
   * text, which is a different problem: as text on the dark surface all five
   * land between 1.1 and 3.1 against a 4.5 minimum. In light they happen to
   * work, so the values match; in dark they are chosen for the ground they sit
   * on, and range from 5.8 to 10.6.
   */
  "status-draft-text": { light: "#475569", dark: "#94a3b8" },
  "status-sent-text": { light: "#1d4ed8", dark: "#60a5fa" },
  "status-accepted-text": { light: "#15803d", dark: "#4ade80" },
  "status-declined-text": { light: "#be123c", dark: "#fb7185" },
  "status-expired-text": { light: "#1f2937", dark: "#cbd5e1" },

  /* The brand colour as text; `brandVars` replaces it per company. */
  "brand-ink": { light: "var(--primary)" },

  /* The customer is on the page right now. Its own colour, not a chart token:
     it's an attention signal, and it shouldn't turn grey because a segment did. */
  "status-viewing": { light: "#b45309", dark: "#fbbf24" },
} satisfies Record<string, ColorToken>;

export type ColorName = keyof typeof COLORS;
export type Scheme = "light" | "dark";

export function colorValue(name: ColorName, scheme: Scheme): string {
  const token: ColorToken = COLORS[name];
  return scheme === "dark" ? (token.dark ?? token.light) : token.light;
}
