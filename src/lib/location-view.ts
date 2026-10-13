/** Pure helpers the location pages format location data with. Type-only imports, so tests need no data files. */
import type { Location, LocationData, SubLocation } from "../../scripts/extract/location-schema";
import type { ItemSources, Mob } from "../../scripts/extract/mob-schema";

export interface LocationCounts {
  readonly mobs: number;
  /** Mobs the game types as bosses (mini-bosses are not counted). */
  readonly bosses: number;
  readonly quests: number;
}

/** What a location card counts; a mob slug with no published mob is not counted. */
export function locationCounts(location: Location, findMob: (slug: string) => Mob | undefined): LocationCounts {
  const mobs = location.mobs.flatMap((slug) => findMob(slug) ?? []);
  return { mobs: mobs.length, bosses: mobs.filter((mob) => mob.kind === "boss").length, quests: location.quests.length };
}

/** The region's levels as one text, e.g. "14 / 45"; empty when the game sets none. */
export const formatLevels = (levels: readonly number[]): string => levels.join(" / ");

/** A sub-location the game names exactly like its region (in English): the page says so, so it does not read as a mistake. */
export const sharesRegionName = (sub: SubLocation, location: Location): boolean => sub.name.en === location.name.en;

/** The location an area id (as mobs.json, quests.json and loot-sources.json use it) belongs to, if one is published. */
export function locationOfArea(data: LocationData, areaId: string): Location | undefined {
  const slug = Object.hasOwn(data.areas, areaId) ? data.areas[areaId] : undefined;
  return slug === undefined ? undefined : data.locations.find((location) => location.slug === slug);
}

/** Item keys ("<category>/<slug>") whose area sources include one of the location's area pools, in loot-sources order. */
export function lootKeys(location: Location, items: Readonly<Record<string, Pick<ItemSources, "areas">>>): string[] {
  const pools = new Set(location.lootSources);
  return Object.entries(items).filter(([, item]) => item.areas.some((id) => pools.has(id))).map(([key]) => key);
}
