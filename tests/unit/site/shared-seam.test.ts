import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

// The dependency direction is scripts -> shared <- src. Nothing in shared/ may reach src/ or scripts/, and
// src/ and scripts/ must not import each other (they meet in shared/, or through the files in src/data/).
const ROOT = resolve(__dirname, "../../..");
const posix = (path: string): string => path.split(sep).join("/");
const SOURCE = /\.(ts|tsx|astro|mjs|js)$/;
const SPECIFIER = /(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']*)["']/g;

const filesUnder = (dir: string): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = posix(join(dir, entry.name));
    return entry.isDirectory() ? filesUnder(path) : SOURCE.test(entry.name) ? [path] : [];
  });

/** Top-level folder of every relative import in `dir`, as "file -> folder" for the ones in `forbidden`. */
const crossings = (dir: string, forbidden: readonly string[]): string[] =>
  filesUnder(dir).flatMap((file) =>
    [...readFileSync(join(ROOT, file), "utf8").matchAll(SPECIFIER)].flatMap(([, specifier]) => {
      const target = posix(relative(ROOT, resolve(dirname(join(ROOT, file)), specifier)));
      return forbidden.some((folder) => target.startsWith(`${folder}/`)) ? [`${file} -> ${target}`] : [];
    }),
  );

describe("shared contracts seam", () => {
  it("shared/ exists and holds the contracts", () => {
    expect(existsSync(join(ROOT, "shared/schemas.ts"))).toBe(true);
    expect(filesUnder("shared").length).toBeGreaterThan(10);
  });
  it("src/ does not import scripts/", () => expect(crossings("src", ["scripts"])).toEqual([]));
  it("scripts/ does not import src/", () => expect(crossings("scripts", ["src"])).toEqual([]));
  it("shared/ imports neither src/ nor scripts/", () => expect(crossings("shared", ["src", "scripts"])).toEqual([]));
});
