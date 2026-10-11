import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Browser scripts must not pull in the UI dictionaries, the game strings or zod: every page would ship them.
const ROOT = resolve(__dirname, "../../..");
const posix = (path: string): string => path.split(sep).join("/");
const FORBIDDEN = [/src\/lib\/ui-strings\.ts$/, /src\/lib\/ui-dicts\.ts$/, /src\/i18n\/.*\.json$/, /ui-game-strings\.json$/, /^zod$/];

const IMPORT = /^\s*(import|export)\s+([^'";]*?)\s*from\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']/gm;

const isTypeOnly = (keyword: string, clause: string): boolean => {
  if (/^type\b/.test(clause)) return true;
  const braces = /^\{([^}]*)\}$/.exec(clause.trim());
  if (!braces) return false;
  const names = braces[1].split(",").map((part) => part.trim()).filter(Boolean);
  return keyword === "import" ? names.length > 0 && names.every((name) => name.startsWith("type ")) : names.every((name) => name.startsWith("type "));
};

/** Specifiers a module loads at run time (type-only imports and re-exports are erased). */
export const runtimeImports = (source: string): string[] =>
  [...source.matchAll(IMPORT)].flatMap((match) => {
    if (match[4]) return [match[4]];
    return isTypeOnly(match[1], match[2]) ? [] : [match[3]];
  });

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
      expect.arrayContaining(["src/components/CategoryTabs.astro", "src/components/ListFilter.astro", "src/components/WorldMap.astro"]),
    );
  });

  it("never load the UI dictionaries, game strings or zod", () => {
    const offenders = cases.flatMap(({ file, script }) =>
      [...reachable(file, script)].filter((target) => FORBIDDEN.some((pattern) => pattern.test(posix(target)))).map((target) => `${posix(relative(ROOT, file))} -> ${posix(relative(ROOT, target))}`),
    );
    expect(offenders).toEqual([]);
  });
});
