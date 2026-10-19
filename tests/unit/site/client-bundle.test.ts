import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { runtimeImports } from "../../helpers/imports";

// Browser scripts must not pull in the UI dictionaries, the game strings or zod: every page would ship them.
const ROOT = resolve(__dirname, "../../..");
const posix = (path: string): string => path.split(sep).join("/");
const FORBIDDEN = [/src\/lib\/ui-strings\.ts$/, /shared\/ui-dicts\.ts$/, /shared\/i18n\/.*\.json$/, /ui-game-strings\.json$/, /^zod$/];

const resolveFile = (from: string, specifier: string): string => {
  if (!specifier.startsWith(".")) return specifier;
  const base = resolve(dirname(from), specifier);
  const candidate = [base, `${base}.ts`, join(base, "index.ts")].find((path) => existsSync(path) && !path.endsWith(specifier.split("/").pop() + "/"));
  return candidate ?? base;
};

/** Every module reachable at run time from `source` (written as if it lived in `file`). */
const reachable = (file: string, source: string, seen = new Set<string>()): Set<string> => {
  for (const specifier of runtimeImports(source)) {
    const target = resolveFile(file, specifier);
    if (seen.has(target)) continue;
    seen.add(target);
    if (/\.(ts|js|mjs)$/.test(target) && existsSync(target)) reachable(target, readFileSync(target, "utf8"), seen);
  }
  return seen;
};

const astroFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? astroFiles(join(dir, entry.name)) : entry.name.endsWith(".astro") ? [join(dir, entry.name)] : [],
  );

/** Bundled (not inline, not data) <script> blocks of a component. */
const clientScripts = (source: string): string[] =>
  [...source.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter((match) => !/is:inline|type=/.test(match[1] ?? "")).map((match) => match[2]);

describe("runtimeImports", () => {
  it("skips type-only imports and re-exports", () => {
    const source = [
      'import type { A } from "./a";',
      'import { type B, type C } from "./b";',
      'import { d, type E } from "./d";',
      'export { f } from "./f";',
      'export type { G } from "./g";',
      'import "./side-effect";',
    ].join("\n");
    expect(runtimeImports(source)).toEqual(["./d", "./f", "./side-effect"]);
  });
});

describe("browser scripts", () => {
  const files = astroFiles(join(ROOT, "src"));
  const cases = files.flatMap((file) => clientScripts(readFileSync(file, "utf8")).map((script) => ({ file, script })));

  it("finds the site's client scripts", () => {
    expect(cases.map(({ file }) => posix(relative(ROOT, file)))).toEqual(
      expect.arrayContaining(["src/components/CategoryTabs.astro", "src/components/ListFilter.astro", "src/components/WorldMap.astro", "src/components/SoulStormClock.astro", "src/components/BuildPlanner.astro"]),
    );
  });

  it("never load the UI dictionaries, game strings or zod", () => {
    const offenders = cases.flatMap(({ file, script }) =>
      [...reachable(file, script)].filter((target) => FORBIDDEN.some((pattern) => pattern.test(posix(target)))).map((target) => `${posix(relative(ROOT, file))} -> ${posix(relative(ROOT, target))}`),
    );
    expect(offenders).toEqual([]);
  });
});
