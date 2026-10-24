/**
 * Compares the site's game data of two game versions record by record. Pure: the caller reads the files (from git
 * and the working tree) and writes the result. Text (names, descriptions) and art paths are not compared, only data.
 */
import type { DiffEntity, DiffField, DiffSource, VersionChanges } from "../../shared/game-changes-schema";
import { DIFF_SOURCES } from "../../shared/game-changes-schema";
import { localizedFrom } from "../../shared/lang";
import type { Localized } from "../../shared/schemas";
import { GRID_CATEGORIES } from "../../shared/sections";

/** The data files a comparison reads, by path under the repository root. */
export const DATA_FILES = {
  entries: "src/data/entries.json",
  weapons: "src/data/weapons.json",
  enchantments: "src/data/enchantments.json",
  artifacts: "src/data/artifacts.json",
  talismans: "src/data/talismans.json",
  mobs: "src/data/mobs.json",
  soulEnchantments: "src/data/soul-enchantments.json",
} as const;
export type DataFile = keyof typeof DATA_FILES;
/** The parsed data files of one version; a file missing in that version is left out. */
export type DataSnapshot = Readonly<Partial<Record<DataFile, unknown>>>;

type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
type JsonObject = { readonly [key: string]: Json };

/** Keys holding text or art rather than game data. */
const SKIPPED_KEYS = new Set(["name", "description", "title", "icon", "portrait", "untranslated", "links"]);
/** Fields that identify an object inside a list, tried in order, so a reordered list does not read as a change. */
const ID_FIELDS = ["slug", "id", "effect", "key", "tier", "attribute"];

const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);
const isLocalized = (value: unknown): boolean => isObject(value) && typeof value.en === "string" && typeof value.zh === "string";
const isPrimitive = (value: Json): boolean => value === null || typeof value !== "object";

const show = (value: Json): string => (Array.isArray(value) ? value.map(show).join(" / ") : isPrimitive(value) ? String(value) : JSON.stringify(value));

/** The id field every object in a list has, with no repeats, if any. */
function listId(list: readonly Json[]): string | undefined {
  if (list.length === 0 || !list.every(isObject)) return undefined;
  return ID_FIELDS.find((field) => {
    const ids = list.map((item) => (item as JsonObject)[field]);
    return ids.every((id) => typeof id === "string" || typeof id === "number") && new Set(ids).size === ids.length;
  });
}

/** Every data leaf of a record as path → value text; a list of plain values is one leaf. */
export function flatten(value: Json, path = ""): ReadonlyMap<string, string> {
  if (isPrimitive(value) || (Array.isArray(value) && value.every(isPrimitive))) return new Map([[path, show(value)]]);
  if (Array.isArray(value)) {
    const id = listId(value);
    if (id === undefined) return new Map(value.flatMap((item, index) => [...flatten(item, `${path}[${index}]`)]));
    // The id is in the path, so it is not a leaf of its own.
    return new Map(
      value.flatMap((item) => {
        const { [id]: key, ...rest } = item as JsonObject;
        const at = `${path}[${id}=${String(key)}]`;
        // An item that is only its id is still a leaf, so adding or removing it shows.
        return Object.keys(rest).length === 0 ? [[at, String(key)] as const] : [...flatten(rest, at)];
      }),
    );
  }
  const object = value as JsonObject;
  return new Map(
    Object.keys(object)
      .filter((key) => !SKIPPED_KEYS.has(key) && !isLocalized(object[key]))
      .flatMap((key) => [...flatten(object[key] as Json, path ? `${path}.${key}` : key)]),
  );
}

/** The fields whose value differs between two versions of a record, in first-seen order. */
export function diffRecord(before: Json, after: Json): DiffField[] {
  const was = flatten(before);
  const now = flatten(after);
  return [...new Set([...was.keys(), ...now.keys()])].flatMap((path): DiffField[] => {
    const a = was.get(path);
    const b = now.get(path);
    if (a === b) return [];
    return [{ path, ...(a === undefined ? {} : { before: a }), ...(b === undefined ? {} : { after: b }) }];
  });
}

interface Source {
  /** The records of a snapshot by slug. */
  readonly records: (data: DataSnapshot) => ReadonlyMap<string, Json>;
  /** Item categories whose entries name these records and give their page. */
  readonly categories?: readonly string[];
  /** Page of a record that carries its own name (mobs, soul enchantments). */
  readonly link?: (slug: string) => string;
}

const field = (value: unknown, key: string): unknown => (isObject(value) ? value[key] : undefined);
const keyed = (value: unknown): ReadonlyMap<string, Json> => new Map(isObject(value) ? Object.entries(value) : []);
const bySlug = (list: unknown): ReadonlyMap<string, Json> =>
  new Map(Array.isArray(list) ? list.flatMap((item: unknown) => (isObject(item) && typeof item.slug === "string" ? [[item.slug, item] as const] : [])) : []);

/** The fields of an item entry that are data: where it is listed and whether it is a unique. */
const entryData = (entry: Json): Json => (isObject(entry) ? { category: entry.category ?? null, variant: entry.variant ?? null, release: entry.release ?? null } : entry);

const SOURCES: Readonly<Record<DiffSource, Source>> = {
  items: {
    records: (data) => new Map([...bySlug(data.entries)].map(([slug, entry]) => [slug, entryData(entry)])),
    categories: [...GRID_CATEGORIES, "armor", "effect"],
  },
  weapons: { records: (data) => keyed(field(data.weapons, "weapons")), categories: ["melee", "ranged"] },
  enchantments: { records: (data) => keyed(data.enchantments), categories: ["enchantment"] },
  artifacts: { records: (data) => keyed(data.artifacts), categories: ["artifact"] },
  talismans: { records: (data) => keyed(data.talismans), categories: ["talisman"] },
  mobs: { records: (data) => bySlug(field(data.mobs, "mobs")), link: (slug) => `mobs/${slug}` },
  soulEnchantments: { records: (data) => bySlug(field(data.soulEnchantments, "families")), link: () => "soul-enchantments" },
};

interface Named {
  readonly name: Localized;
  readonly link?: string;
}

const PAGED_CATEGORIES: readonly string[] = GRID_CATEGORIES;

/** Name and page of an item entry with this slug in one of `categories`. */
function itemName(data: DataSnapshot, categories: readonly string[], slug: string): Named | undefined {
  const entries = Array.isArray(data.entries) ? (data.entries as readonly { slug: string; category: string; name: Localized }[]) : [];
  const entry = entries.find((one) => one.slug === slug && categories.includes(one.category));
  if (entry === undefined) return undefined;
  return { name: entry.name, ...(PAGED_CATEGORIES.includes(entry.category) ? { link: `${entry.category}/${entry.slug}` } : {}) };
}

function named(source: Source, data: DataSnapshot, record: Json | undefined, slug: string): Named {
  const fallback = localizedFrom(() => slug);
  if (source.categories) return itemName(data, source.categories, slug) ?? { name: fallback };
  const name = field(record, "name");
  return { name: isLocalized(name) ? (name as Localized) : fallback, ...(source.link ? { link: source.link(slug) } : {}) };
}

function diffSource(source: Source, before: DataSnapshot, after: DataSnapshot): DiffEntity[] {
  const was = source.records(before);
  const now = source.records(after);
  return [...new Set([...was.keys(), ...now.keys()])].sort().flatMap((slug): DiffEntity[] => {
    const old = was.get(slug);
    const current = now.get(slug);
    // A removed record has no page left to link to.
    const { name, link } = current === undefined ? named(source, before, old, slug) : named(source, after, current, slug);
    const base = { slug, name, ...(link && current !== undefined ? { link } : {}) };
    if (old === undefined) return [{ ...base, status: "added", fields: [] }];
    if (current === undefined) return [{ ...base, status: "removed", fields: [] }];
    const fields = diffRecord(old, current);
    return fields.length === 0 ? [] : [{ ...base, status: "changed", fields }];
  });
}

/** The data changes from game version `from` to `to`, grouped by source; sources without changes are left out. */
export function diffVersions(from: string, to: string, before: DataSnapshot, after: DataSnapshot): VersionChanges {
  const groups = DIFF_SOURCES.flatMap((source) => {
    const entities = diffSource(SOURCES[source], before, after);
    return entities.length === 0 ? [] : [{ source, entities }];
  });
  return { from, to, groups };
}

/** `changes` with the comparison for `next.to` replaced or added at the front (newest first). */
export const withVersion = (changes: readonly VersionChanges[], next: VersionChanges): VersionChanges[] => [
  next,
  ...changes.filter((one) => one.to !== next.to),
];
