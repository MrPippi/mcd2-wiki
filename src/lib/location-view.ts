/** Pure helpers the location pages format location data with. Type-only imports, so tests need no data files. */
import type { Category } from "../../scripts/extract/config";
import type { Location, LocationData, SubLocation } from "../../scripts/extract/location-schema";
import type { ItemSources, Mob } from "../../scripts/extract/mob-schema";
import type { Quest } from "../../scripts/extract/quest-schema";
import type { Entry } from "../../scripts/extract/schemas";

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

/** The categories an area loot list shows, in display order. */
export const LOOT_CATEGORIES = ["melee", "ranged", "armor", "artifact", "talisman", "enchantment-book"] as const satisfies readonly Category[];

/** One listed item. `unconfirmed` marks a book whose pool reaches the region while the data places no book chest there; `extra` marks items beyond the area drop pool. */
export interface LootItem {
  readonly entry: Entry;
  readonly unconfirmed: boolean;
  readonly extra: boolean;
}

export interface LootGroup {
  readonly category: Category;
  readonly items: readonly LootItem[];
}

const keyOf = (entry: Entry): string => `${entry.category}/${entry.slug}`;

/**
 * Groups items by category in LOOT_CATEGORIES order, empty groups left out. An item listed twice keeps its first place,
 * but a confirmed listing wins over an unconfirmed one; items of other categories are not shown.
 */
export function groupLoot(items: readonly LootItem[]): LootGroup[] {
  const confirmed = new Set(items.filter((item) => !item.unconfirmed).map((item) => keyOf(item.entry)));
  const seen = new Set<string>();
  const unique = items.flatMap((item) => {
    const key = keyOf(item.entry);
    if (seen.has(key)) return [];
    seen.add(key);
    return [confirmed.has(key) ? { ...item, unconfirmed: false } : item];
  });
  return LOOT_CATEGORIES.map((category) => ({ category, items: unique.filter((item) => item.entry.category === category) })).filter((group) => group.items.length > 0);
}

/**
 * The item keys the mobs drop for certain: a slot that draws from its own list, takes no rolls, gives at least one guaranteed
 * drop and names exactly one item (Mosstrosity's Llama talisman, the Witch's Brew).
 */
export const mobSureItemKeys = (mobs: readonly Mob[]): string[] => [
  ...new Set(mobs.flatMap((mob) => mob.drops.filter((drop) => drop.pool === "own" && drop.guaranteed > 0 && drop.rolls === 0 && drop.items?.length === 1).flatMap((drop) => drop.items ?? []))),
];

/** The item keys the quests give, once each, in quest and reward order (a quest that lets the player pick lists every choice). */
export const questRewardKeys = (quests: readonly Quest[]): string[] => [
  ...new Set(quests.flatMap((quest) => [...quest.rewards.first, ...quest.rewards.every].flatMap((reward) => (reward.kind === "items" ? reward.items : [])))),
];
