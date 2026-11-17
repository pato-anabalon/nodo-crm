import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Every handler under `app/api/m` is built by `mobileRoute`, `mobileUserRoute`
 * or `mobilePublicRoute`. A handler written by hand skips the bearer check, the
 * company header and the membership behind it — and would work perfectly in
 * every test that sends a valid token, which is why this reads the source.
 */

const ROOT = join(process.cwd(), "src/app/api/m");
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === "route.ts" ? [path] : [];
  });
}

const files = routeFiles(ROOT);

it("finds the app's routes", () => {
  expect(files.length).toBeGreaterThan(0);
});

it.each(files.map((file) => [relative(process.cwd(), file), file]))("%s builds every handler through the helper", (_, file) => {
  const source = readFileSync(file, "utf8");
  const exported = METHODS.filter((method) => new RegExp(`export\\s+(const|async\\s+function|function)\\s+${method}\\b`).test(source));

  expect(exported.length).toBeGreaterThan(0);
  for (const method of exported) {
    expect(source).toMatch(new RegExp(`export\\s+const\\s+${method}\\s*=\\s*mobile(Public|User)?Route\\(`));
  }
});
