/** Which areas each bestiary mob is known to appear in: area standing mobs plus arena-wave mobs mapped through a hand-written prefix table. */
import { z } from "zod";
import { issue, type Issue } from "./issues";
import { localize, locRef } from "./loc-table";
import type { MapData } from "./map-schema";
import type { Lang } from "./config";
import type { MobArea } from "./mob-schema";
import type { AreaRow, MobTables } from "./mob-tables";
import { normalizeTag, tagKey } from "./mob-tags";
import type { LocaleFile, Localized } from "./schemas";
import prefixData from "./spawn-area-prefixes.json";

const NAME_KEY = 'TagName="SW.TextEntry.Name"';
const PREFIX_SEGMENTS = 4;

/** SW.Area.Meadow.T1.Rift.N → SW.Area.Meadow.T1; shorter tags are left alone. */
export const areaPrefix = (tag: string): string => normalizeTag(tag).split(".").slice(0, PREFIX_SEGMENTS).join(".");

export type AreaNamer = (tag: string) => Localized | undefined;

/** Looks an area's name up by its tag; undefined when there is no such row or the row has no English text. */
export function buildAreaNamer(areas: readonly AreaRow[], locales: Readonly<Record<Lang, LocaleFile>>): AreaNamer {
  const rows = new Map<string, AreaRow>();
  for (const row of areas) if (!rows.has(tagKey(row.TypeTag.TagName))) rows.set(tagKey(row.TypeTag.TagName), row);
  return (tag) => {
    const entry = Object.entries(rows.get(tagKey(tag))?.TypeTextData?.Texts ?? {}).find(([key]) => key.includes(NAME_KEY));
    const ref = entry ? locRef(entry[1].Text) : undefined;
    const name = ref ? localize(locales, ref.namespace, ref.key) : undefined;
    return name?.en ? name : undefined;
  };
}

export type PrefixMap = Readonly<Record<string, string | null>>;
export const SPAWN_AREA_PREFIXES: PrefixMap = z.record(z.string(), z.string().nullable()).parse(prefixData);

export interface AreaMarker {
  readonly world: "overworld" | "sift" | "camp";
  readonly px: number;
  readonly py: number;
}

const AREA_ID = "area:";
export function areaMarkers(map: MapData): ReadonlyMap<string, AreaMarker> {
  const result = new Map<string, AreaMarker>();
  for (const world of map.worlds) {
    for (const marker of world.markers) {
      if (marker.kind === "area" && marker.id.startsWith(AREA_ID)) result.set(marker.id.slice(AREA_ID.length), { world: world.key, px: marker.px, py: marker.py });
    }
  }
  return result;
}

export interface MobAreasInput {
  readonly tables: MobTables;
  readonly tagIndex: ReadonlyMap<string, string>;
  readonly namer: AreaNamer;
  readonly prefixes: PrefixMap;
  readonly markers: ReadonlyMap<string, AreaMarker>;
}

type Found = ReadonlyMap<string, ReadonlySet<string>>;   // areaId -> mob tag keys

const add = (found: Map<string, Set<string>>, areaId: string, mobTag: string): void => {
  const set = found.get(areaId) ?? new Set<string>();
  set.add(tagKey(mobTag));
  found.set(areaId, set);
};

const standingMobs = (areas: readonly AreaRow[]): Map<string, Set<string>> => {
  const found = new Map<string, Set<string>>();
  for (const row of areas) {
    const id = areaPrefix(row.TypeTag.TagName);
    for (const group of row.AreaDefinition?.ConditionGroups ?? []) {
      for (const mob of group.DefaultDefinition?.MobTypes ?? []) add(found, id, mob.MobType.TagName);
    }
  }
  return found;
};

function waveMobs(input: MobAreasInput, found: Map<string, Set<string>>): Issue[] {
  const unmapped = new Map<string, number>();
  for (const row of input.tables.waves) {
    const prefix = row.Name.split("_")[0] ?? row.Name;
    const target = input.prefixes[prefix];
    if (target === undefined) {
      unmapped.set(prefix, (unmapped.get(prefix) ?? 0) + 1);
      continue;
    }
    if (target === null) continue;
    for (const wave of row.SpawnWaveDefinition?.Waves ?? []) {
      for (const mob of wave.Waves ?? []) add(found, areaPrefix(target), mob.MobType.TagName);
    }
  }
  return [...unmapped].map(([prefix, rows]) => issue("mob-area-prefix-unmapped", `${prefix} (${rows} wave rows)`));
}

function bySlug(found: Found, input: MobAreasInput): { areasBySlug: Map<string, MobArea[]>; issues: Issue[] } {
  const areasBySlug = new Map<string, MobArea[]>();
  const issues: Issue[] = [];
  for (const [areaId, mobTags] of found) {
    const slugs = new Set([...mobTags].flatMap((key) => input.tagIndex.get(key) ?? []));
    if (slugs.size === 0) continue;
    const name = input.namer(areaId);
    if (!name) {
      issues.push(issue("mob-area-unnamed", areaId));
      continue;
    }
    const marker = input.markers.get(tagKey(areaId));
    const area: MobArea = { areaId, name, ...(marker ? { map: { world: marker.world, px: marker.px, py: marker.py } } : {}) };
    for (const slug of slugs) areasBySlug.set(slug, [...(areasBySlug.get(slug) ?? []), area]);
  }
  return { areasBySlug, issues };
}

export function buildMobAreas(input: MobAreasInput): { areasBySlug: ReadonlyMap<string, readonly MobArea[]>; issues: Issue[] } {
  const found = standingMobs(input.tables.areas);
  const prefixIssues = waveMobs(input, found);
  const { areasBySlug, issues } = bySlug(found, input);
  const sorted = new Map([...areasBySlug].map(([slug, areas]) => [slug, [...areas].sort((a, b) => a.name.en.localeCompare(b.name.en) || a.areaId.localeCompare(b.areaId))] as const));
  return { areasBySlug: sorted, issues: [...prefixIssues, ...issues] };
}
