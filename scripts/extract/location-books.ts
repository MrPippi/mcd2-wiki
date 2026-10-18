/**
 * Which enchantment books a region can give, from the book pools that reach it and the chests that are placed there:
 * - a book pool reaches a region when the area row that carries the pool is the region's area or above it (the global pool, carried
 *   by the root area, reaches every region that has an area drop pool or a pool of its own);
 * - the books are `certain` when a chest that drops books (loot-sources bookDrops) has a spawn quota in one of the region's areas
 *   (DT_AreaDefinition), otherwise `inferred`: the pool reaches the region but the data places no book chest there.
 * Mobs that drop books (the Piggy Bank) have no area, so they place nothing.
 */
import { bookPoolCarriers } from "./drop-sources";
import type { Location, LocationData } from "./location-schema";
import type { LootTables } from "./loot-tables";
import type { ItemSourcesData } from "./mob-schema";
import { tagKey } from "./mob-tags";

export interface BookInput {
  readonly data: LocationData;
  readonly sources: ItemSourcesData;
  readonly loot: LootTables;
  /** Lower-cased chest tag -> the area tags that spawn it (drop-tables.ts chestPlacements). */
  readonly placements: ReadonlyMap<string, readonly string[]>;
}

const ROOT_AREA = "sw.area";
const CHEST = /^chest:/;

/** Every area tag of the region, lower-cased. */
function areasOf(location: Location, data: LocationData): string[] {
  const owned = Object.entries(data.areas).filter(([, slug]) => slug === location.slug).map(([id]) => id);
  return [...new Set([location.areaId, ...location.subLocations.flatMap((place) => place.areaIds), ...owned].map(tagKey))];
}

const within = (tag: string, area: string): boolean => tag === area || tag.startsWith(`${area}.`);

/** True when a chest that drops books is spawned in one of the areas. */
function hasPlacedBookChest(areas: readonly string[], input: BookInput): boolean {
  const tags = input.sources.bookDrops
    .filter((drop) => CHEST.test(drop.id))
    .flatMap((drop) => input.loot.lootActor.filter((row) => row.Name === drop.id.replace(CHEST, "")).map((row) => tagKey(row.TypeTag.TagName)));
  return tags.some((tag) => (input.placements.get(tag) ?? []).some((spot) => areas.some((area) => within(tagKey(spot), area))));
}

/** The books of the pools that reach the region, in loot-sources order. */
function reachingBooks(location: Location, areas: readonly string[], input: BookInput): string[] {
  const carriers = bookPoolCarriers(input.sources, input.loot);
  const own = [...carriers].filter(([, carrier]) => tagKey(carrier) !== ROOT_AREA && areas.some((area) => within(area, tagKey(carrier)))).map(([id]) => id);
  // The global pool reaches every region the drop tables know: one with an area drop pool or a pool of its own.
  const global = location.lootSources.length > 0 || own.length > 0 ? [...carriers].filter(([, carrier]) => tagKey(carrier) === ROOT_AREA).map(([id]) => id) : [];
  const reaching = new Set([...own, ...global]);
  return Object.entries(input.sources.items)
    .filter(([key, item]) => key.startsWith("enchantment-book/") && item.bookPools.some((id) => reaching.has(id)))
    .map(([key]) => key);
}

/** The location data with `books` added to every region a book pool reaches. */
export function addLocationBooks(input: BookInput): LocationData {
  const locations = input.data.locations.map((location): Location => {
    const areas = areasOf(location, input.data);
    const books = reachingBooks(location, areas, input);
    if (books.length === 0) return location;
    return { ...location, books: hasPlacedBookChest(areas, input) ? { certain: books, inferred: [] } : { certain: [], inferred: books } };
  });
  return { ...input.data, locations };
}
