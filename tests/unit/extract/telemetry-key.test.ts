import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");
const CONSTANTS = path.join(ROOT, "source-data", "DataTables", "UFS", "OnlineConstants.json");
const DATA = path.join(ROOT, "src", "data");
const PUBLIC = path.join(ROOT, "public");
const MIN_LENGTH = 20;

const stringValues = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringValues);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringValues);
  return [];
};

/** Every string value of at least MIN_LENGTH characters in the telemetry constants. */
const telemetryValues = (): string[] =>
  stringValues(JSON.parse(readFileSync(CONSTANTS, "utf8").replace(/^\uFEFF/, ""))).filter((value) => value.length >= MIN_LENGTH);

/** Every file under a folder, recursively. */
const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((item) => (item.isDirectory() ? filesUnder(path.join(dir, item.name)) : [path.join(dir, item.name)]));

describe("telemetry constants", () => {
  it.skipIf(!existsSync(CONSTANTS))("never reach the published data", () => {
    const secrets = telemetryValues();
    expect(secrets.length).toBeGreaterThan(0);
    for (const file of readdirSync(DATA).filter((name) => name.endsWith(".json"))) {
      const text = readFileSync(path.join(DATA, file), "utf8");
      for (const secret of secrets) expect(text.includes(secret), `${file} contains a telemetry value`).toBe(false);
    }
  });

  it.skipIf(!existsSync(CONSTANTS))("never reach the published static files (public/, any file type)", () => {
    const secrets = telemetryValues();
    const files = filesUnder(PUBLIC);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const bytes = readFileSync(file);
      for (const secret of secrets) expect(bytes.includes(secret), `${path.relative(ROOT, file)} contains a telemetry value`).toBe(false);
    }
  });

  it("is never named by extractor code", () => {
    const sources = readdirSync(path.join(ROOT, "scripts", "extract")).filter((name) => name.endsWith(".ts") && name !== "table-reader.ts");
    for (const name of sources) expect(readFileSync(path.join(ROOT, "scripts", "extract", name), "utf8"), name).not.toMatch(/OnlineConstants/);
  });
});
