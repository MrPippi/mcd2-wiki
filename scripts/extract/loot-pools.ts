/** Effective item pools of loot rows: Set tags minus Multiply-0 exclusions, optionally expanded to items. */
import type { ItemIndex, ItemRef } from "./loot-items";
import { slotsOf } from "./loot-slots";
import type { LootRow, LootSlotValue } from "./loot-tables";
import type { LootSlotKey } from "./mob-schema";
import { tagKey } from "./mob-tags";

interface PoolEntry {
  readonly TypeTag: { readonly TagName: string };
  readonly Weight: number;
  readonly Operation: string;
}

const entriesOf = (slot: LootSlotValue): readonly PoolEntry[] => slot.DropTable.Tags ?? [];
const isExclusion = (entry: PoolEntry): boolean => entry.Operation === "Multiply" && entry.Weight === 0;

function uniqueByKey<T>(items: readonly T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Every slot of a row as written, including the nameless one the exclusion rows use (slotsOf drops it). */
export const rawSlots = (row: LootRow): LootSlotValue[] => Object.values(row.LootDropDefinition.LootSlots ?? {});

/** Only the Multiply-0 tags, as written, in first-seen order. */
export function excludedTags(slot: LootSlotValue): string[] {
  return uniqueByKey(entriesOf(slot).filter(isExclusion), (entry) => tagKey(entry.TypeTag.TagName)).map((entry) => entry.TypeTag.TagName);
}

/** The Set tags with their weights, minus exclusions found in the slot itself or in any slot of the exclusion rows. */
export function poolEntries(slot: LootSlotValue, exclusionRows: readonly LootRow[] = []): { tag: string; weight: number }[] {
  const excluded = new Set([slot, ...exclusionRows.flatMap(rawSlots)].flatMap(excludedTags).map(tagKey));
  const kept = entriesOf(slot).filter((entry) => entry.Operation === "Set" && entry.Weight > 0 && !excluded.has(tagKey(entry.TypeTag.TagName)));
  return uniqueByKey(kept, (entry) => tagKey(entry.TypeTag.TagName)).map((entry) => ({ tag: entry.TypeTag.TagName, weight: entry.Weight }));
}

export const poolTags = (slot: LootSlotValue, exclusionRows: readonly LootRow[] = []): string[] =>
  poolEntries(slot, exclusionRows).map((entry) => entry.tag);

/** The exclusion rows a row names in its own Traits.GameplayTags (e.g. AllEnchantmentBooks -> EnchantmentBooksExcludeQuestBooks). */
export const exclusionRowsOf = (row: LootRow, byTypeTag: ReadonlyMap<string, LootRow>): LootRow[] =>
  (row.Traits?.GameplayTags ?? []).flatMap((tag) => byTypeTag.get(tagKey(tag.TagName)) ?? []);

/** The effective pool tags of one slot of a row; [] when the row has no such slot. */
export function rowPool(row: LootRow, slotKey: LootSlotKey, byTypeTag: ReadonlyMap<string, LootRow>): string[] {
  const slot = slotsOf(row).get(slotKey);
  return slot === undefined ? [] : poolTags(slot, exclusionRowsOf(row, byTypeTag));
}

export interface PoolItem {
  readonly ref: ItemRef;
  /** Weight of the first pool tag that listed the item. */
  readonly weight: number;
}

/** A tag as items: an item or armor set tag, else every item with that trait (category tags such as Property.Armor). */
const itemsOf = (tag: string, index: ItemIndex): readonly ItemRef[] => {
  const direct = index.resolve(tag);
  return direct.length > 0 ? direct : index.withTrait(tag);
};

/**
 * The items a slot can give: pool tags expanded through the item index (items, sets, then traits), minus the items
 * the exclusion tags expand to. Pool tags that match nothing are returned in `unmatched` (never dropped silently).
 */
export function resolvePool(row: LootRow, slotKey: LootSlotKey, byTypeTag: ReadonlyMap<string, LootRow>, index: ItemIndex): { items: PoolItem[]; unmatched: string[] } {
  const slot = slotsOf(row).get(slotKey);
  if (slot === undefined) return { items: [], unmatched: [] };
  const exclusionRows = exclusionRowsOf(row, byTypeTag);
  const excluded = new Set([slot, ...exclusionRows.flatMap(rawSlots)].flatMap(excludedTags).flatMap((tag) => itemsOf(tag, index)).map((ref) => ref.key));
  const expanded = poolEntries(slot).map((entry) => ({ entry, refs: itemsOf(entry.tag, index) }));
  const items = uniqueByKey(
    expanded.flatMap(({ entry, refs }) => refs.map((ref) => ({ ref, weight: entry.weight }))),
    (item) => item.ref.key,
  ).filter((item) => !excluded.has(item.ref.key));
  return { items, unmatched: expanded.filter(({ refs }) => refs.length === 0).map(({ entry }) => entry.tag) };
}

/** Groups of tags that differ only in spelling (Springstone / SpringStone), sorted inside and between groups. */
export const tagVariants = (rows: readonly LootRow[]): string[][] => {
  const spellings = new Map<string, Set<string>>();
  for (const tag of rows.flatMap(rawSlots).flatMap(entriesOf).map((entry) => entry.TypeTag.TagName)) {
    spellings.set(tagKey(tag), new Set([...(spellings.get(tagKey(tag)) ?? []), tag]));
  }
  return [...spellings.values()]
    .filter((group) => group.size > 1)
    .map((group) => [...group].sort())
    .sort((a, b) => a[0].localeCompare(b[0]));
};
