/** Indexes the item DataTable rows by loot tag: exact item tags, armor set tags (expanded to pieces) and trait tags. */
import { entryIndex, locId } from "./game-rows";
import { ITEM_TABLE_CATEGORY, ITEM_TABLE_KEYS, type LootTables } from "./loot-tables";
import { tagKey } from "./mob-tags";
import { ARMOR_PIECES, type Entry } from "./schemas";

export interface ItemRef {
  /** `${category}/${slug}` */
  readonly key: string;
  readonly entry: Entry;
  /** The item row's TypeTag, as the game writes it. */
  readonly tag: string;
  /** tagKey of every Traits.GameplayTags and Traits.ParentTags tag (real armor lists Property.Armor only as a parent). */
  readonly traits: ReadonlySet<string>;
}

export interface ItemIndex {
  /** An item TypeTag -> that item; SW.Item.ArmorSet.<X> -> the set's pieces (helmet, chest, leggings, boots); anything else -> []. */
  readonly resolve: (tag: string) => readonly ItemRef[];
  /** Every item that has the trait, in table order. */
  readonly withTrait: (traitTag: string) => readonly ItemRef[];
  /** True for an item tag or an armor set tag. */
  readonly knownTag: (tag: string) => boolean;
  /** "<table>:<row name>" of item rows that match no site entry, for the report. */
  readonly unresolvedRows: readonly string[];
}

const SET_PREFIX = "sw.item.armorset.";

const pieceRank = (ref: ItemRef): number => {
  const rank = ref.entry.armorPiece === undefined ? -1 : ARMOR_PIECES.indexOf(ref.entry.armorPiece);
  return rank === -1 ? ARMOR_PIECES.length : rank;
};

function collectRefs(tables: LootTables, entries: readonly Entry[]): { refs: ItemRef[]; unresolvedRows: string[] } {
  const find = entryIndex(entries);
  const rows = ITEM_TABLE_KEYS.flatMap((table) =>
    tables[table].map((row) => {
      const category = ITEM_TABLE_CATEGORY[table];
      const entry = find(category, locId(row.TypeTextData) ?? row.Name);
      const names = [...(row.Traits?.GameplayTags ?? []), ...(row.Traits?.ParentTags ?? [])].map((tag) => tagKey(tag.TagName));
      const ref: ItemRef | undefined = entry && { key: `${category}/${entry.slug}`, entry, tag: row.TypeTag.TagName, traits: new Set(names) };
      return { ref, row: `${category}:${row.Name}` };
    }),
  );
  return { refs: rows.flatMap(({ ref }) => ref ?? []), unresolvedRows: rows.flatMap(({ ref, row }) => (ref ? [] : [row])) };
}

export function buildItemIndex(tables: LootTables, entries: readonly Entry[]): ItemIndex {
  const { refs, unresolvedRows } = collectRefs(tables, entries);
  const byTag = new Map<string, ItemRef>();
  const bySet = new Map<string, ItemRef[]>();
  for (const ref of refs) {
    if (!byTag.has(tagKey(ref.tag))) byTag.set(tagKey(ref.tag), ref);
    for (const trait of ref.traits) {
      // The bare "sw.item.armorset" parent tag has no trailing dot, so it never counts as a set.
      if (trait.startsWith(SET_PREFIX)) bySet.set(trait, [...(bySet.get(trait) ?? []), ref]);
    }
  }
  const sets = new Map([...bySet].map(([set, pieces]) => [set, [...pieces].sort((a, b) => pieceRank(a) - pieceRank(b))] as const));
  return {
    resolve: (tag) => {
      const key = tagKey(tag);
      const item = byTag.get(key);
      return item ? [item] : (sets.get(key) ?? []);
    },
    withTrait: (traitTag) => refs.filter((ref) => ref.traits.has(tagKey(traitTag))),
    knownTag: (tag) => byTag.has(tagKey(tag)) || sets.has(tagKey(tag)),
    unresolvedRows,
  };
}
