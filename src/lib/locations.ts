/** The location and boss pages' data from `npm run extract`, validated at build time, and the lookups they link with. Server-side only. */
import type { Category } from "../../shared/config";
import { LocationDataSchema, type Location, type LocationData } from "../../shared/location-schema";
import { ItemSourcesSchema, type Mob } from "../../shared/mob-schema";
import type { Entry } from "../../shared/schemas";
import rawLocations from "../data/locations.json";
import rawSources from "../data/loot-sources.json";
import { bossGroups, type BossGroup } from "./boss-view";
import { findEntry } from "./data";
import type { Lang } from "../../shared/lang";
import { groupLoot, locationCounts, locationOfArea, lootKeys, mobSureItemKeys, questRewardKeys, type LocationCounts, type LootGroup, type LootItem } from "./location-view";
import { findMob, mobData, mobGroups, type MobGroup } from "./mobs";
import { questData, questsOf, rewardEntries } from "./quests";
import type { Quest } from "../../shared/quest-schema";
import { GAME_NAME } from "./site-title";
import { t } from "./ui-strings";
import { href } from "./url";

export const locationData: LocationData = LocationDataSchema.parse(rawLocations);
const lootItems = ItemSourcesSchema.parse(rawSources).items;

const LOCATIONS_BY_SLUG: ReadonlyMap<string, Location> = new Map(locationData.locations.map((location) => [location.slug, location]));

export const findLocation = (slug: string): Location | undefined => LOCATIONS_BY_SLUG.get(slug);

export const locationHref = (lang: Lang, slug: string): string => href(lang, "locations", slug);

/** The published location an area id belongs to, if any. */
export const locationOf = (areaId: string): Location | undefined => locationOfArea(locationData, areaId);

export const countsOf = (location: Location): LocationCounts => locationCounts(location, findMob);

/** The location's mobs grouped by kind, like the bestiary. */
export const locationMobGroups = (location: Location): MobGroup[] => mobGroups(location.mobs.flatMap((slug) => findMob(slug) ?? []));

export const locationQuests = (location: Location): Quest[] => questsOf(location.quests);

/** The published item entries of the location's area drop pools, in loot-sources order. */
export const locationLoot = (location: Location): Entry[] =>
  lootKeys(location, lootItems).flatMap((key) => {
    const [category, slug] = key.split("/");
    return (category && slug && findEntry(category as Category, slug)) || [];
  });

const groupedItems = (entries: readonly Entry[], flags: Pick<LootItem, "extra" | "unconfirmed">): LootItem[] => entries.map((entry) => ({ entry, ...flags }));

/**
 * What the region's loot list shows, by category: the area drop pool, then what the data makes certain beyond it (items its
 * bosses always drop, books of chests placed there), then books whose pool reaches the region without a placed chest, marked unconfirmed.
 */
export const locationLootGroups = (location: Location): LootGroup[] =>
  groupLoot([
    ...groupedItems(locationLoot(location), { extra: false, unconfirmed: false }),
    ...groupedItems(rewardEntries(mobSureItemKeys(location.mobs.flatMap((slug) => findMob(slug) ?? []))), { extra: true, unconfirmed: false }),
    ...groupedItems(rewardEntries(location.books?.certain ?? []), { extra: true, unconfirmed: false }),
    ...groupedItems(rewardEntries(location.books?.inferred ?? []), { extra: true, unconfirmed: true }),
  ]);

/** The fixed items of the region's quests, by category. */
export const locationRewardGroups = (location: Location): LootGroup[] =>
  groupLoot(groupedItems(rewardEntries(questRewardKeys(locationQuests(location))), { extra: false, unconfirmed: false }));

/** A location page's meta description: its name, the locations page and the game, in the page language. */
export const locationDescription = (location: Location, lang: Lang): string => [location.name[lang], t(lang, "locations"), GAME_NAME].join(" · ");

/** The bosses page's groups, in story order (see boss-view.ts). */
export const bossList = (mobs: readonly Mob[] = mobData.mobs): BossGroup[] => bossGroups(mobs, questData.quests, locationOf);
