import { COLORS, type ColorToken } from "./colors";
import { RADII, WEB_RADII } from "./shape";
import { TYPE_SCALE, type TypeRole } from "./typography";

/**
 * The web's half: the whole of `apps/web/src/app/tokens.css`, which
 * `globals.css` imports. Generated rather than written so the two apps can't
 * drift, and a test in the web fails when the file is older than this package
 * (`pnpm --filter web tokens` rewrites it).
 */
export function tokensCss(): string {
  const colors = Object.entries(COLORS) as [string, ColorToken][];

  const root = [`--radius: ${rem(RADII.lg)};`, ...colors.map(([name, token]) => `--${name}: ${token.light};`)];
  const dark = colors.flatMap(([name, token]) => (token.dark ? [`--${name}: ${token.dark};`] : []));

  const theme = [
    ...WEB_RADII.map((name) => `--radius-${name}: ${rem(RADII[name])};`),
    // The small step that predates the scale; the codemod renames it `label`.
    "--text-2xs: 0.6875rem;",
    "--text-2xs--line-height: 0.875rem;",
    ...Object.entries(TYPE_SCALE).flatMap(([name, role]) => typeVars(name, role)),
    ...colors.flatMap(([name, token]) => (token.utility ? [`--color-${name}: var(--${name});`] : [])),
  ];

  return [
    "/* Generated from packages/tokens by `pnpm --filter web tokens`. Edit there, not here. */",
    "",
    block(":root", root),
    "",
    block(".dark", dark),
    "",
    block("@theme inline", theme),
    "",
  ].join("\n");
}

function typeVars(name: string, role: TypeRole): string[] {
  return [
    `--text-${name}: ${rem(role.size)};`,
    `--text-${name}--line-height: ${rem(role.leading)};`,
    `--text-${name}--letter-spacing: ${role.tracking}em;`,
    ...(role.weight ? [`--text-${name}--font-weight: ${role.weight};`] : []),
  ];
}

function block(selector: string, lines: string[]): string {
  return [`${selector} {`, ...lines.map((line) => `  ${line}`), "}"].join("\n");
}

const rem = (px: number) => `${Number((px / 16).toFixed(4))}rem`;
