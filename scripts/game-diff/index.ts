/**
 * `npm run game-diff -- <git ref>`: after extracting a new game version (which sets shared/game-version.json),
 * compares the data committed at <ref> (the previous version) with the working tree and records the result in
 * src/data/game-changes.json for the update log page.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { GameChangesSchema } from "../../shared/game-changes-schema";
import { DATA_FILES, diffVersions, withVersion, type DataFile, type DataSnapshot } from "./diff";

const OUTPUT = "src/data/game-changes.json";
/** Where the game version was kept over time; the newest path first. */
const VERSION_FILES = ["shared/game-version.json", "scripts/extract/game-version.json"];

function gitShow(ref: string, path: string): string | undefined {
  try {
    return execFileSync("git", ["show", `${ref}:${path}`], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return undefined;
  }
}

const versionOf = (text: string | undefined, where: string): string => {
  const version: unknown = text === undefined ? undefined : (JSON.parse(text) as { version?: unknown }).version;
  if (typeof version !== "string") throw new Error(`No game version found in ${where}.`);
  return version;
};

function snapshot(read: (path: string) => string | undefined): DataSnapshot {
  return Object.fromEntries(
    (Object.entries(DATA_FILES) as [DataFile, string][]).flatMap(([file, path]) => {
      const text = read(path);
      return text === undefined ? [] : [[file, JSON.parse(text) as unknown]];
    }),
  );
}

const readWorking = (path: string): string | undefined => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
};

function main(): void {
  const ref = process.argv[2];
  if (!ref) throw new Error("Usage: npm run game-diff -- <git ref of the previous game version's data>");
  const from = versionOf(VERSION_FILES.map((path) => gitShow(ref, path)).find((text) => text !== undefined), `${ref}`);
  const to = versionOf(readWorking(VERSION_FILES[0] ?? ""), VERSION_FILES[0] ?? "");
  if (from === to) throw new Error(`${ref} already has game version ${to}: set shared/game-version.json to the new version first.`);

  const changes = diffVersions(from, to, snapshot((path) => gitShow(ref, path)), snapshot(readWorking));
  const existing = GameChangesSchema.parse(JSON.parse(readFileSync(OUTPUT, "utf8")));
  writeFileSync(OUTPUT, `${JSON.stringify(GameChangesSchema.parse(withVersion(existing, changes)), null, 2)}\n`);
  const count = changes.groups.reduce((sum, group) => sum + group.entities.length, 0);
  process.stdout.write(`${from} → ${to}: ${count} changed records written to ${OUTPUT}\n`);
}

main();
