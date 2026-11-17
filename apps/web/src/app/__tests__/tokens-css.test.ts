/** @jest-environment node */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tokensCss } from "@nodo/tokens/css";

/**
 * `tokens.css` is generated from packages/tokens, which the app reads as well.
 * Edited by hand, or left behind after the package changed, the two apps draw
 * different colours with nothing to say so — run `pnpm --filter web tokens`.
 */
it("is what packages/tokens generates", () => {
  expect(readFileSync(join(process.cwd(), "src/app/tokens.css"), "utf8")).toBe(tokensCss());
});

it("is imported by the stylesheet, before anything uses it", () => {
  const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  expect(globals).toContain('@import "./tokens.css";');
  expect(globals).not.toMatch(/^\s*--(background|primary|panel):/m);
});
