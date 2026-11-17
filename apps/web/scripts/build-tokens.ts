import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tokensCss } from "@nodo/tokens/css";

/** Rewrites `src/app/tokens.css` from packages/tokens. `tokens-css.test.ts` fails until it has run. */
const path = join(process.cwd(), "src/app/tokens.css");
writeFileSync(path, tokensCss());
console.info(`Wrote ${path}`);
