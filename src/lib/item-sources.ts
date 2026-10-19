/** The item page's view of loot-sources.json: an item's source ids joined with their names. Pure; type-only imports. */
import type { BookDrop, ItemSources, ItemSourcesData, LootSource } from "../../shared/mob-schema";

export interface ResolvedSource extends LootSource {
  /** The source id ("<kind>:<row id>"). */
  readonly id: string;
}

export interface ResolvedItemSources {
  readonly areas: readonly ResolvedSource[];
  readonly chests: readonly (ResolvedSource & { readonly pool: ItemSources["chests"][number]["pool"] })[];
  readonly quests: readonly (ResolvedSource & { readonly picks?: { readonly count: number; readonly of: number } })[];
  readonly merchants: readonly (ResolvedSource & { readonly category: string })[];
  readonly bookPools: readonly ResolvedSource[];
}

export type ResolvedBookDrop = ResolvedSource & Omit<BookDrop, "id">;

function source(data: ItemSourcesData, id: string): ResolvedSource {
  const found = Object.hasOwn(data.sources, id) ? data.sources[id] : undefined;
  if (found === undefined) throw new Error(`loot-sources.json: item refers to unknown source ${id}`);
  return { id, ...found };
}

/** The item's sources with names, or undefined when the game data gives it none (the page then shows no block). */
export function sourcesFor(data: ItemSourcesData, key: string): ResolvedItemSources | undefined {
  const item = Object.hasOwn(data.items, key) ? data.items[key] : undefined;
  if (item === undefined) return undefined;
  return {
    areas: item.areas.map((id) => source(data, id)),
    chests: item.chests.map((chest) => ({ ...source(data, chest.id), pool: chest.pool })),
    quests: item.quests.map((quest) => ({ ...source(data, quest.id), ...(quest.picks ? { picks: quest.picks } : {}) })),
    merchants: item.merchants.map((merchant) => ({ ...source(data, merchant.id), category: merchant.category })),
    bookPools: item.bookPools.map((id) => source(data, id)),
  };
}

/** The chests and mobs that drop a book from their area's pool, with names. */
export const bookDropsOf = (data: ItemSourcesData): ResolvedBookDrop[] =>
  data.bookDrops.map(({ id, ...rule }) => ({ ...source(data, id), ...rule }));
