/**
 * The profile of one trigger: the item-bearing slots it can roll and the rarity rows that apply, before items are numbered.
 * A trigger is several tags together (see drop-slots.ts); a mob is a counted list of slots over its area's pool instead.
 */
import { poolWeights } from "./drop-pool";
import { contextRarityOps, type RarityRow } from "./drop-rarity-rows";
import { tagKey } from "./mob-tags";
import { closureOf, mergeSlots, type Resolved, type SlotResolver } from "./drop-slots";
import type { RarityOp } from "../../src/lib/drop-types";

/** The slots that can give an item; emeralds, spring stones, food and TNT are not items the site has pages for. */
export const ITEM_SLOTS: readonly string[] = ["item", "specialgear", "enchantedbook", "talismans", "none"];

export interface RawSlot {
  readonly slot: string;
  readonly guaranteed: number;
  readonly rolls: number;
  readonly chance: number;
  /** Item id → weight, only the entries that can be drawn. */
  readonly pool: readonly (readonly [string, number])[];
}

export interface RawProfile {
  readonly slots: readonly RawSlot[];
  readonly rarity: readonly RarityOp[];
}

export interface ProfileContext {
  readonly resolver: SlotResolver;
  readonly parents: (tag: string) => readonly string[];
  readonly rarityRows: readonly RarityRow[];
  /** Whether an item id is one the site has a page for (a pool without one tells nothing a page can show). */
  readonly isPublished: (id: string) => boolean;
}

/** A slot that draws at least once and can draw a published item; the others are dropped. */
function usable(context: ProfileContext, name: string, merged: Resolved | undefined): RawSlot[] {
  if (!merged || (merged.guaranteed <= 0 && !(merged.rolls > 0 && merged.chance > 0))) return [];
  const pool = poolWeights(merged.pool);
  return pool.some(([id]) => context.isPublished(id))
    ? [{ slot: name, guaranteed: merged.guaranteed, rolls: merged.rolls, chance: merged.chance, pool }]
    : [];
}

const rarityOf = (context: ProfileContext, tags: readonly string[]): RarityOp[] => contextRarityOps(closureOf(tags, context.parents), context.rarityRows);

/** The profile of a trigger made of these tags together (a chest and its area, a quest reward and its areas). */
export function profileOfTags(context: ProfileContext, tags: readonly string[]): RawProfile {
  // A tag twice (a quest's area named by the entry and by the quest) must not count twice.
  const once = tags.filter((tag, index) => tags.findIndex((other) => tagKey(other) === tagKey(tag)) === index);
  const names = context.resolver.slotNames(once).filter((name) => ITEM_SLOTS.includes(name));
  return {
    slots: names.flatMap((name) => usable(context, name, mergeSlots(once.map((tag) => context.resolver.resolve(tag, name))))),
    rarity: rarityOf(context, once),
  };
}

export interface SlotSpec {
  readonly slot: string;
  readonly guaranteed: number;
  readonly rolls: number;
  readonly chance: number;
}

/** The profile of a source whose counts are given (a mob) and whose pools come from the area tag; `tags` feed the rarity rows. */
export function profileOfSpecs(context: ProfileContext, specs: readonly SlotSpec[], areaTag: string, tags: readonly string[]): RawProfile {
  return {
    slots: specs.flatMap((spec) => {
      const area = context.resolver.resolve(areaTag, spec.slot);
      return usable(context, spec.slot, area && { ...spec, pool: area.pool });
    }),
    rarity: rarityOf(context, [...tags, areaTag]),
  };
}
