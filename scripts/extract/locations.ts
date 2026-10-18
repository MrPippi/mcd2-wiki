/**
 * Builds src/data/locations.json: one location per region of the hand-kept list (location-regions.json), with its
 * name, area icon, progression level, map marker and folded sub-locations, and the mobs, quests and area loot pools
 * that mobs.json, quests.json and loot-sources.json place there. Every row left out and every gap is an issue.
 *
 * Note on the region list (JSON has no comments): SW.Area.Lush.Boss carries the parent trait SW.Area.DeepDark.Dungeons,
 * yet it is listed as its own region (Lush Caves), as the brief's region list asks. This is the one exception to
 * following parent traits; SW.Area.Peaks.A1.AreaLink, whose tag and parent trait disagree, is left out instead.
 */
import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { Lang } from "./config";
import { loadDropTables } from "./drop-tables";
import { referencePaths } from "./icon-references";
import { ExtractError, formatZodIssue, issue, type Issue } from "./issues";
import { assignRows, foldSubLocations, ownerOf, rowName, type RegionRows } from "./location-assign";
import { EMPTY_LOCATIONS, LocationDataSchema, RegionListSchema, type Location, type LocationData, type RegionList, type RegionRule } from "./location-schema";
import { addLocationBooks } from "./location-books";
import { loadLocationTables, type LocationTables, type ProgressionRow } from "./location-tables";
import type { MapData } from "./map-schema";
import { loadLootTables } from "./loot-tables";
import { areaMarkers, type AreaMarker } from "./mob-areas";
import type { ItemSourcesData, MobData } from "./mob-schema";
import { tagKey } from "./mob-tags";
import type { QuestData } from "./quest-schema";
import type { LocaleFile } from "./schemas";
import regionData from "./location-regions.json";

/** The game's area icons, published first. */
const AREA_ICON_DIR = "/Icons/Location/AreaIcons/";
/** The world-map pins (SpicewoodUI mount); the game gives these to regions with no area art (the Deep Dark, the Ravines), so they are the fallback. */
const WORLD_MAP_PIN_DIR = "/Texture/WorldMap/Icons/";
const NO_PROGRESSION = "SW.Progression.None";
const AREA_SOURCE = "area:";
export function parseRegionList(raw: unknown): RegionList {
  const parsed = RegionListSchema.safeParse(raw);
  if (!parsed.success) throw new ExtractError(`地區清單格式錯誤：${formatZodIssue(parsed.error.issues[0])}`);
  return parsed.data;
}

/** The hand-kept region list. */
export const REGION_LIST: RegionList = parseRegionList(regionData);

export const locationIconPath = (slug: string): string => `icons/locations/${slug}.png`;

export interface LocationsInput {
  readonly sourceRoot: string;
  readonly outRoot: string;
  readonly locales: Readonly<Record<Lang, LocaleFile>>;
  readonly map: MapData;
  readonly mobs: MobData;
  readonly quests: QuestData;
  readonly sources: ItemSourcesData;
  /** Defaults to location-regions.json. */
  readonly regions?: RegionList;
}

export interface Joins {
  readonly mobs: MobData;
  readonly quests: QuestData;
  readonly sources: ItemSourcesData;
}

export interface BuildContext {
  readonly locales: Readonly<Record<Lang, LocaleFile>>;
  readonly markers: ReadonlyMap<string, AreaMarker>;
  readonly levels: ReadonlyMap<string, number>;
  /** The source file an AreaIcon reference resolves to, if it exists. */
  readonly iconFile: (reference: string) => string | undefined;
}

export interface IconCopy {
  readonly from: string;
  readonly published: string;
}

export const levelsOf = (rows: readonly ProgressionRow[]): Map<string, number> =>
  new Map(rows.flatMap((row) => (row.ProgressionData ? [[tagKey(row.TypeTag.TagName), row.ProgressionData.PlayerLevel] as const] : [])));

/** The levels of the region's own rows, ascending; a row with no progression or an unknown one is reported. */
function regionLevels(slug: string, rows: RegionRows, levels: ReadonlyMap<string, number>): { levels: number[]; issues: Issue[] } {
  const found = rows.own.map((row) => {
    const tag = row.AreaDefinition?.ProgressionDefinition?.TagName ?? "None";
    if (tag === "None" || tagKey(tag) === tagKey(NO_PROGRESSION)) return { issues: [issue("location-no-level", `${slug}: ${row.TypeTag.TagName} has no progression`)] };
    const level = levels.get(tagKey(tag));
    return level === undefined ? { issues: [issue("location-no-level", `${slug}: ${tag} is not in the progression table`)] } : { level, issues: [] };
  });
  return {
    levels: [...new Set(found.flatMap((one) => (one.level === undefined ? [] : [one.level])))].sort((a, b) => a - b),
    issues: found.flatMap((one) => one.issues),
  };
}

/** The region's area icon: the first own row's AreaIcon that is a game area icon, else a world-map pin, with a file. */
function regionIcon(slug: string, rows: RegionRows, ctx: BuildContext): { icon?: IconCopy; issues: Issue[] } {
  const references = rows.own.map((row) => row.AreaIcon ?? "None").filter((one) => one !== "None");
  if (references.length === 0) return { issues: [issue("location-no-icon", `${slug}: no AreaIcon`)] };
  const reference = references.find((one) => one.includes(AREA_ICON_DIR)) ?? references.find((one) => one.includes(WORLD_MAP_PIN_DIR));
  if (!reference) return { issues: [issue("location-no-icon", `${slug}: ${references[0]} is not an area icon`)] };
  const file = ctx.iconFile(reference);
  return file ? { icon: { from: file, published: locationIconPath(slug) }, issues: [] } : { issues: [issue("location-no-icon", `${slug}: ${reference} has no file`)] };
}

interface Built {
  readonly location: Location;
  readonly icon?: IconCopy;
  readonly issues: Issue[];
}

function buildRegion(rule: RegionRule, rows: RegionRows, ctx: BuildContext): Built | { issues: Issue[] } {
  const first = rows.own[0];
  const name = first ? rowName(first, ctx.locales) : undefined;
  if (!first || !name) return { issues: [issue("location-region-missing", `${rule.slug}: ${first ? "no name" : "no row"} for ${rule.areas.join(", ")}`)] };
  const levels = regionLevels(rule.slug, rows, ctx.levels);
  const icon = regionIcon(rule.slug, rows, ctx);
  const subs = foldSubLocations(rule.slug, rows.sub, ctx.locales);
  const marker = rule.areas.map((tag) => ctx.markers.get(tagKey(tag))).find((one) => one !== undefined);
  const location: Location = {
    slug: rule.slug,
    areaId: first.TypeTag.TagName,
    name: name.text,
    untranslated: name.untranslated,
    ...(marker ? { map: { world: marker.world, px: marker.px, py: marker.py } } : {}),
    ...(icon.icon ? { icon: icon.icon.published } : {}),
    levels: levels.levels,
    subLocations: subs.subLocations,
    mobs: [],
    quests: [],
    lootSources: [],
  };
  const fallback = name.untranslated.length > 0 ? [issue("location-text-fallback", `${rule.slug}: ${name.text.en}: ${name.untranslated.join(", ")}`)] : [];
  return { location, icon: icon.icon, issues: [...fallback, ...levels.issues, ...icon.issues, ...subs.issues] };
}

interface Link {
  readonly areaId: string;
  readonly what: string;
  readonly add: (location: Location) => Location;
}

/** Every mob area, quest region and area loot pool, as a link to add to the location that owns its area. */
function linksOf(joins: Joins): Link[] {
  const append = (key: "mobs" | "quests" | "lootSources", value: string) => (location: Location): Location =>
    location[key].includes(value) ? location : { ...location, [key]: [...location[key], value] };
  return [
    ...joins.mobs.mobs.flatMap((mob) => mob.areas.map((area) => ({ areaId: area.areaId, what: `mob ${mob.slug}`, add: append("mobs", mob.slug) }))),
    ...joins.quests.quests.flatMap((quest) => (quest.region ? [{ areaId: quest.region.areaId, what: `quest ${quest.slug}`, add: append("quests", quest.slug) }] : [])),
    ...Object.keys(joins.sources.sources)
      .filter((id) => id.startsWith(AREA_SOURCE))
      .map((id) => ({ areaId: id.slice(AREA_SOURCE.length), what: `loot ${id}`, add: append("lootSources", id) })),
  ];
}

/** Adds the joins to the locations and indexes every joined area id; an area no published location owns is reported. */
export function joinLocations(list: RegionList, locations: readonly Location[], joins: Joins): { data: LocationData; issues: Issue[] } {
  const bySlug = new Map(locations.map((location) => [location.slug, location]));
  const areas: Record<string, string> = {};
  const issues: Issue[] = [];
  for (const link of linksOf(joins)) {
    const owner = ownerOf(list, link.areaId);
    const location = owner.kind === "region" ? bySlug.get(owner.region.slug) : undefined;
    if (!location) {
      issues.push(issue("location-area-unowned", `${link.what}: ${link.areaId}`));
      continue;
    }
    bySlug.set(location.slug, link.add(location));
    areas[link.areaId] = location.slug;
  }
  const data = LocationDataSchema.parse({ locations: locations.map((location) => bySlug.get(location.slug) ?? location), areas });
  return { data, issues };
}

/** The location data from parsed tables and the already built mobs, quests and loot sources. */
export function buildLocationData(tables: LocationTables, list: RegionList, joins: Joins, ctx: BuildContext): { data: LocationData; icons: IconCopy[]; issues: Issue[] } {
  const assigned = assignRows(list, tables.areas);
  const built = list.regions.map((rule) => buildRegion(rule, assigned.byRegion.get(rule.slug) ?? { own: [], sub: [] }, ctx));
  const kept = built.flatMap((one) => ("location" in one ? [one] : []));
  const joined = joinLocations(list, kept.map((one) => one.location), joins);
  return {
    data: joined.data,
    icons: kept.flatMap((one) => (one.icon ? [one.icon] : [])),
    issues: [...assigned.issues, ...built.flatMap((one) => one.issues), ...joined.issues],
  };
}

/** Copies the area icons; run after public/icons is rebuilt, since that step clears the folder. */
async function publishIcons(outRoot: string, icons: readonly IconCopy[]): Promise<void> {
  for (const icon of icons) {
    const to = path.join(outRoot, "public", ...icon.published.split("/"));
    await mkdir(path.dirname(to), { recursive: true });
    await copyFile(icon.from, to);
  }
}

export interface LocationsResult {
  readonly data: LocationData;
  readonly issues: Issue[];
  readonly tablesRead: readonly string[];
}

/** Adds the enchantment books of each region; without the loot and drop tables (a source-data without them) the regions get none. */
async function withBooks(input: LocationsInput, data: LocationData, onRead: (file: string) => void): Promise<LocationData> {
  const loot = await loadLootTables(input.sourceRoot, onRead);
  const { tables } = await loadDropTables(input.sourceRoot, onRead);
  return loot && tables ? addLocationBooks({ data, sources: input.sources, loot, placements: tables.placements }) : data;
}

export async function extractLocations(input: LocationsInput): Promise<LocationsResult> {
  const tablesRead: string[] = [];
  const loaded = await loadLocationTables(input.sourceRoot, (file) => {
    tablesRead.push(file);
  });
  if (!loaded.tables) return { data: EMPTY_LOCATIONS, issues: loaded.issues, tablesRead };
  const iconFile = (reference: string): string | undefined =>
    referencePaths(reference).map((file) => path.join(input.sourceRoot, ...file.split("/"))).find((file) => existsSync(file));
  const ctx: BuildContext = { locales: input.locales, markers: areaMarkers(input.map), levels: levelsOf(loaded.tables.progression), iconFile };
  const built = buildLocationData(loaded.tables, input.regions ?? REGION_LIST, input, ctx);
  await publishIcons(input.outRoot, built.icons);
  const data = await withBooks(input, built.data, (file) => {
    tablesRead.push(file);
  });
  return { data, issues: [...loaded.issues, ...built.issues], tablesRead };
}
