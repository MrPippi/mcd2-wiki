/**
 * Which region owns an area tag, by the hand-kept region list: the longest listed tag that covers it wins, a region's
 * or an exclusion's alike. Area rows then split into a region's own rows, its sub-locations (folded by name) and the
 * rows left out; every row left out or without a name is reported.
 */
import { localizedFrom } from "../../src/lib/lang";
import { LANGS, type Lang } from "./config";
import { issue, type Issue } from "./issues";
import { locRef, type LocRef } from "./loc-table";
import type { RegionList, RegionRule, SubLocation } from "./location-schema";
import type { LocationAreaRow } from "./location-tables";
import { tagKey } from "./mob-tags";
import { questText, type QuestText } from "./quest-texts";
import type { LocaleFile, Localized } from "./schemas";

type Locales = Readonly<Record<Lang, LocaleFile>>;

export type Owner =
  | { readonly kind: "region"; readonly region: RegionRule }
  | { readonly kind: "excluded"; readonly reason: string }
  | { readonly kind: "none" };

const WILDCARD = ".*";
const segments = (tag: string): number => tag.split(".").length;

/** Whether `prefix` is `tag` or one of its parents (whole segments, any case). */
export const covers = (prefix: string, tag: string): boolean => {
  const [p, t] = [tagKey(prefix), tagKey(tag)];
  return t === p || t.startsWith(`${p}.`);
};

interface Claim {
  readonly depth: number;
  readonly owner: Owner;
}

function regionClaims(list: RegionList, tag: string): Claim[] {
  return list.regions.flatMap((region) =>
    [...region.areas, ...(region.members ?? [])].filter((prefix) => covers(prefix, tag)).map((prefix) => ({ depth: segments(prefix), owner: { kind: "region", region } as const })),
  );
}

function exclusionClaims(list: RegionList, tag: string): Claim[] {
  return Object.entries(list.excluded).flatMap(([key, reason]) => {
    const wildcard = key.endsWith(WILDCARD);
    const prefix = wildcard ? key.slice(0, -WILDCARD.length) : key;
    const hit = wildcard ? covers(prefix, tag) : tagKey(prefix) === tagKey(tag);
    return hit ? [{ depth: segments(prefix), owner: { kind: "excluded", reason } as const }] : [];
  });
}

/** The owner of an area tag; the longest covering entry wins, and on a tie the exclusion. */
export function ownerOf(list: RegionList, tag: string): Owner {
  const claims = [...regionClaims(list, tag), ...exclusionClaims(list, tag)];
  const best = claims.reduce<Claim | undefined>((top, claim) => (!top || claim.depth >= top.depth ? claim : top), undefined);
  return best?.owner ?? { kind: "none" };
}

const NAME_KEY = 'TagName="SW.TextEntry.Name"';

/** The loc reference of a row's name, if it has one. */
export function nameRef(row: LocationAreaRow): LocRef | undefined {
  const entry = Object.entries(row.TypeTextData?.Texts ?? {}).find(([key]) => key.includes(NAME_KEY));
  return entry ? locRef(entry[1].Text) : undefined;
}

/** A row's name in every language with its English stand-ins; undefined when the game has no usable English name. */
export function rowName(row: LocationAreaRow, locales: Locales): QuestText | undefined {
  const ref = nameRef(row);
  return ref ? questText(locales, ref.namespace, ref.key) : undefined;
}

export interface RegionRows {
  /** The rows that are the region itself, in table order. */
  readonly own: readonly LocationAreaRow[];
  /** The other rows it owns, in table order. */
  readonly sub: readonly LocationAreaRow[];
}

const where = (row: LocationAreaRow): string => `${row.TypeTag.TagName} (${row.Name})`;

/** Splits the area rows by owner; rows left out or owned by nothing listed are reported. */
export function assignRows(list: RegionList, rows: readonly LocationAreaRow[]): { byRegion: ReadonlyMap<string, RegionRows>; issues: Issue[] } {
  const byRegion = new Map<string, RegionRows>(list.regions.map((region) => [region.slug, { own: [], sub: [] }]));
  const issues: Issue[] = [];
  for (const row of rows) {
    const owner = ownerOf(list, row.TypeTag.TagName);
    if (owner.kind === "excluded") issues.push(issue("location-excluded", `${where(row)}: ${owner.reason}`));
    if (owner.kind === "none") issues.push(issue("location-unassigned", where(row)));
    if (owner.kind !== "region") continue;
    const current = byRegion.get(owner.region.slug) ?? { own: [], sub: [] };
    const isOwn = owner.region.areas.some((tag) => tagKey(tag) === tagKey(row.TypeTag.TagName));
    byRegion.set(owner.region.slug, isOwn ? { ...current, own: [...current.own, row] } : { ...current, sub: [...current.sub, row] });
  }
  return { byRegion, issues };
}

const VARIANT_SEPARATOR = " / ";

/** One line per English name; a language that names the folded rows differently lists each of its names, so none is lost. */
function mergeNames(names: readonly Localized[]): Localized {
  return localizedFrom((lang) => [...new Set(names.map((name) => name[lang]))].join(VARIANT_SEPARATOR));
}

/**
 * Sub-location rows folded by English name: procedural dungeons and rifts share one name, and so does one place split
 * into several rows. Each line keeps all its tags. A row with no usable English name is reported and left out.
 */
export function foldSubLocations(slug: string, rows: readonly LocationAreaRow[], locales: Locales): { subLocations: SubLocation[]; issues: Issue[] } {
  const named = rows.map((row) => ({ row, name: rowName(row, locales) }));
  const english = [...new Set(named.flatMap(({ name }) => (name ? [name.text.en] : [])))];
  const subLocations = english.map((en) => {
    const members = named.flatMap(({ row, name }) => (name?.text.en === en ? [{ row, name }] : []));
    return {
      name: mergeNames(members.map(({ name }) => name.text)),
      untranslated: LANGS.filter((lang) => members.some(({ name }) => name.untranslated.includes(lang))),
      areaIds: members.map(({ row }) => row.TypeTag.TagName),
    };
  });
  return {
    subLocations,
    issues: [
      ...named.filter(({ name }) => !name).map(({ row }) => issue("location-unnamed", `${slug}: ${where(row)}`)),
      ...subLocations.filter((line) => line.untranslated.length > 0).map((line) => issue("location-text-fallback", `${slug}: ${line.name.en}: ${line.untranslated.join(", ")}`)),
    ],
  };
}
