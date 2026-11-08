import { contrastRatio } from "@nodo/core/theme/color";
import type { ColorName, Scheme } from "../colors";
import { palette } from "../native";

/**
 * Every token that is written *as text* clears 4.5:1 against the grounds it is
 * written on, in light and in dark — measured, the way `inkOn` measures,
 * because OKLCH lightness says nothing reliable about WCAG contrast.
 *
 * The shortfalls that exist today are listed with their measured value rather
 * than left out: a new one fails here, and fixing one fails until it is taken
 * off the list.
 */

const BODY_GROUNDS: ColorName[] = ["background", "card", "panel", "muted", "field"];
const CARD_GROUNDS: ColorName[] = ["background", "card"];

const TEXT_ON: [ColorName, ColorName[]][] = [
  ["foreground", BODY_GROUNDS],
  ["card-foreground", ["card"]],
  ["muted-foreground", BODY_GROUNDS],
  ["primary", CARD_GROUNDS],
  ["destructive", CARD_GROUNDS],
  ["status-draft-text", CARD_GROUNDS],
  ["status-sent-text", CARD_GROUNDS],
  ["status-accepted-text", CARD_GROUNDS],
  ["status-declined-text", CARD_GROUNDS],
  ["status-expired-text", CARD_GROUNDS],
  ["status-viewing", CARD_GROUNDS],
];

/** Text drawn on its own fill: a button, a badge. */
const FILLS: [ColorName, ColorName][] = [
  ["primary-foreground", "primary"],
  ["destructive-foreground", "destructive"],
  ["status-draft-fg", "status-draft"],
  ["status-sent-fg", "status-sent"],
  ["status-accepted-fg", "status-accepted"],
  ["status-declined-fg", "status-declined"],
  ["status-expired-fg", "status-expired"],
];

const KNOWN_SHORT: Record<string, number> = {
  "light muted-foreground on panel": 4.26,
  "light muted-foreground on muted": 4.35,
  "light muted-foreground on field": 4.05,
  "dark destructive-foreground on destructive": 2.76,
};

const pairs = (["light", "dark"] as Scheme[]).flatMap((scheme) => [
  ...TEXT_ON.flatMap(([text, grounds]) => grounds.map((ground) => [scheme, text, ground] as const)),
  ...FILLS.map(([text, fill]) => [scheme, text, fill] as const),
]);

it.each(pairs)("%s %s on %s reads", (scheme, text, ground) => {
  const colors = palette(scheme);
  const ratio = contrastRatio(colors[text], colors[ground])!;
  const known = KNOWN_SHORT[`${scheme} ${text} on ${ground}`];

  if (known === undefined) expect(ratio).toBeGreaterThanOrEqual(4.5);
  else expect(Number(ratio.toFixed(2))).toBeCloseTo(known, 1);
});

it("lists only shortfalls that are still short", () => {
  for (const key of Object.keys(KNOWN_SHORT)) {
    const [scheme, text, , ground] = key.split(" ") as [Scheme, ColorName, string, ColorName];
    expect(contrastRatio(palette(scheme)[text], palette(scheme)[ground])!).toBeLessThan(4.5);
  }
});
