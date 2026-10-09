import { CATEGORIES, type Category, type Lang, type Release, type TableSource } from "./config";
import { issue, type Issue } from "./issues";
import { parseKey } from "./keys";
import type { LocaleFile, Localized } from "./schemas";

export interface RawEntry {
  readonly id: string;
  readonly category: Category;
  readonly release: Release;
  readonly untranslated: Lang[];
  readonly name: Localized;
  readonly description?: Localized;
  readonly descriptionLong?: Localized;
}

type TextField = "name" | "description" | "descriptionLong";
type Draft = Omit<RawEntry, "name"> & { readonly name?: Localized };

interface Cell {
  readonly category: Category;
  readonly release: Release;
  readonly id: string;
  readonly field: TextField;
  readonly text: Localized;
  readonly untranslated: Lang[];
}

const FIELD_MAP: Readonly<Record<string, TextField>> = {
  name: "name",
  description: "description",
  description_long: "descriptionLong",
};
const PLACEHOLDER_ONLY = /^\s*(?:\{\w+\}\s*)+$/;

const isMissing = (value: string | undefined, key: string): boolean =>
  value === undefined || value.trim() === "" || value === key;

const isPlaceholderOnly = (text: Localized): boolean =>
  PLACEHOLDER_ONLY.test(text.en) && PLACEHOLDER_ONLY.test(text.zh);

export function resolveText(
  key: string,
  en: string | undefined,
  zh: string | undefined,
): { text?: Localized; untranslated: Lang[] } {
  const enMissing = isMissing(en, key);
  const zhMissing = isMissing(zh, key);
  if (enMissing && zhMissing) return { untranslated: [] };
  const enText = (enMissing ? zh : en) as string;
  const zhText = (zhMissing ? en : zh) as string;
  const untranslated: Lang[] = [...(zhMissing ? (["zh"] as const) : []), ...(enMissing ? (["en"] as const) : [])];
  return { text: { zh: zhText, en: enText }, untranslated };
}

function readCell(table: TableSource, key: string, en: string, zh: string | undefined): { cell?: Cell; issues: Issue[] } {
  const parsed = parseKey(key);
  if (!parsed) return { issues: [issue("skipped-key", `${table.namespace} › ${key}`)] };
  const field = FIELD_MAP[parsed.field.toLowerCase()];
  if (!field) return { issues: [issue("ignored-field", `${parsed.id}.${parsed.field}`)] };
  const { text, untranslated } = resolveText(key, en, zh);
  if (!text) return { issues: [issue("missing-text", `${table.namespace} › ${key}`)] };
  if (field !== "name" && isPlaceholderOnly(text)) {
    return { issues: [issue("placeholder-only", `${parsed.id}.${parsed.field}`)] };
  }
  const cell: Cell = { category: table.category, release: table.release, id: parsed.id, field, text, untranslated };
  return { cell, issues: [] };
}

function readTable(table: TableSource, locales: Record<Lang, LocaleFile>): { cells: Cell[]; issues: Issue[] } {
  const enTable = locales.en[table.namespace];
  if (!enTable) return { cells: [], issues: [issue("missing-namespace", table.namespace)] };
  const zhTable = locales.zh[table.namespace] ?? {};
  const results = Object.entries(enTable).map(([key, en]) => readCell(table, key, en, zhTable[key]));
  return {
    cells: results.flatMap((result) => (result.cell ? [result.cell] : [])),
    issues: results.flatMap((result) => result.issues),
  };
}

function mergeCells(cells: readonly Cell[]): Draft[] {
  const drafts = new Map<string, Draft>();
  for (const cell of cells) {
    const key = `${cell.category}:${cell.id}`;
    const previous: Draft = drafts.get(key) ?? {
      id: cell.id,
      category: cell.category,
      release: cell.release,
      untranslated: [],
    };
    const untranslated = [...new Set([...previous.untranslated, ...cell.untranslated])];
    drafts.set(key, { ...previous, [cell.field]: cell.text, untranslated });
  }
  return [...drafts.values()];
}

const compareRaw = (a: RawEntry, b: RawEntry): number =>
  CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.id.localeCompare(b.id, "en");

export function groupEntries(
  locales: Record<Lang, LocaleFile>,
  tables: readonly TableSource[],
): { entries: RawEntry[]; issues: Issue[] } {
  const read = tables.map((table) => readTable(table, locales));
  const drafts = mergeCells(read.flatMap((result) => result.cells));
  const named = drafts.filter((draft): draft is RawEntry => draft.name !== undefined);
  const missingName = drafts
    .filter((draft) => draft.name === undefined)
    .map((draft) => issue("missing-name", `${draft.category}:${draft.id}`));
  const untranslated = named
    .filter((entry) => entry.untranslated.length > 0)
    .map((entry) => issue("untranslated", `${entry.category}:${entry.id} (${entry.untranslated.join(", ")})`));
  return {
    entries: [...named].sort(compareRaw),
    issues: [...read.flatMap((result) => result.issues), ...missingName, ...untranslated],
  };
}
