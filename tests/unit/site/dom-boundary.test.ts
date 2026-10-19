import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Modules that touch the DOM (mount functions, event wiring, document/window) live in src/client/;
// src/lib/ and shared/ stay pure so they run under plain vitest and in Node.
const ROOT = resolve(__dirname, "../../..");
const posix = (path: string): string => path.split(sep).join("/");
const BROWSER_GLOBAL = /(?<![.\w$])(document|window|localStorage|sessionStorage|navigator)\./;

/** Files that may reference a browser global, with the reason. Keep this list empty unless there is no better home. */
const ALLOWED: Readonly<Record<string, string>> = {};

const filesUnder = (dir: string): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = posix(join(dir, entry.name));
    return entry.isDirectory() ? filesUnder(path) : entry.name.endsWith(".ts") ? [path] : [];
  });

/** Source with comments removed (strings are kept). */
const code = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("DOM boundary", () => {
  it.each(["src/lib", "shared"])("%s has no document/window references", (dir) => {
    const offenders = filesUnder(dir).filter((file) => !(file in ALLOWED) && BROWSER_GLOBAL.test(code(readFileSync(join(ROOT, file), "utf8"))));
    expect(offenders).toEqual([]);
  });

  it("the allow-list only names files that still need it", () => {
    for (const file of Object.keys(ALLOWED)) expect(BROWSER_GLOBAL.test(code(readFileSync(join(ROOT, file), "utf8")))).toBe(true);
  });

  it("src/client holds the browser modules", () => {
    expect(filesUnder("src/client").length).toBeGreaterThan(10);
  });
});
