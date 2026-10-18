import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CATEGORIES, type Category } from "./config";
import { ExtractError, formatZodIssue } from "./issues";
import { ArmorSetSchema, EntrySchema, type ArmorSet, type Entry } from "./schemas";

export interface IconCopy {
  readonly from: string;
  readonly to: string;
}

export interface ExtractOutput {
  readonly entries: Entry[];
  readonly armorSets: ArmorSet[];
}

export const iconWebPath = (category: Category, slug: string): string => `icons/${category}/${slug}.png`;

export function sortEntries(entries: readonly Entry[]): Entry[] {
  return [...entries].sort(
    (a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.slug.localeCompare(b.slug, "en"),
  );
}

export function validateOutput(entries: readonly Entry[], armorSets: readonly ArmorSet[]): ExtractOutput {
  const parsedEntries = z.array(EntrySchema).safeParse(entries);
  if (!parsedEntries.success) {
    throw new ExtractError(`輸出條目驗證失敗：${formatZodIssue(parsedEntries.error.issues[0])}`);
  }
  const parsedSets = z.array(ArmorSetSchema).safeParse(armorSets);
  if (!parsedSets.success) {
    throw new ExtractError(`輸出護甲套裝驗證失敗：${formatZodIssue(parsedSets.error.issues[0])}`);
  }
  return { entries: parsedEntries.data, armorSets: parsedSets.data };
}

const toJson = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
/** The bestiary files and the affix pools are written on one line each so they stay under the 200 KB data-file limit (the pools: 300 KB). */
const COMPACT_FILES: ReadonlySet<string> = new Set(["mobs.json", "loot-sources.json", "affix-models.json", "drop-models.json"]);
const serialize = (fileName: string, value: unknown): string => (COMPACT_FILES.has(fileName) ? `${JSON.stringify(value)}\n` : toJson(value));

export async function writeOutputs(
  outRoot: string,
  output: ExtractOutput,
  /** Extra data files keyed by file name, e.g. { "frames.json": {...} }. */
  extraData: Readonly<Record<string, unknown>>,
  report: string,
): Promise<void> {
  const dataDir = path.join(outRoot, "src", "data");
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, "entries.json"), toJson(output.entries), "utf8");
  await writeFile(path.join(dataDir, "armor-sets.json"), toJson(output.armorSets), "utf8");
  for (const [fileName, value] of Object.entries(extraData)) {
    await writeFile(path.join(dataDir, fileName), serialize(fileName, value), "utf8");
  }
  await writeFile(path.join(outRoot, "extract-report.md"), report, "utf8");
}

export async function copyIcons(copies: readonly IconCopy[], iconsDir: string): Promise<void> {
  await rm(iconsDir, { recursive: true, force: true });
  for (const copy of copies) {
    await mkdir(path.dirname(copy.to), { recursive: true });
    await copyFile(copy.from, copy.to);
  }
}
