/**
 * The items a drop can give, from the item DataTables, and which tags name which of them. A pool entry names an item by its
 * own tag, by an armor set, or by a property all member items carry (SW.Item.Property.MeleeWeapon), so membership needs every
 * trait an item has in game:
 * - its own and parent tags;
 * - the traits of the item row whose own tag it carries (the elemental quivers carry the Quiver row's tag);
 * - SW.Item.Property.Artifact for every row of the artifact table, which two totems leave out of their traits.
 * Only rows with SW.Property.Spawnable are drawable; the rows without it (the armor piece templates, the plain Quiver) are not.
 */
import { entryIndex, locId } from "./game-rows";
import { ITEM_TABLE_CATEGORY, ITEM_TABLE_KEYS, type ItemTagRow, type LootTables } from "./loot-tables";
import { tagKey } from "./mob-tags";
import type { MembersOf } from "./drop-pool";
import type { Entry } from "../../shared/schemas";

export interface UniverseItem {
  /** The lower-cased item tag. */
  readonly id: string;
  /** "<category>/<slug>" as loot-sources.json keys items; undefined for an item the site has no page for. */
  readonly key?: string;
  /** Every trait the item has in game, lower-cased. */
  readonly all: ReadonlySet<string>;
  /** Id of the Unique variant a Unique rarity roll turns this item into. */
  readonly sub?: string;
  /** The rarities the item can roll (bit mask: 1 Common, 2 Rare, 4 Special, 8 Unique); none for what has no rarity. */
  readonly allowed?: number;
}

export interface Universe {
  readonly items: ReadonlyMap<string, UniverseItem>;
  readonly membersOf: MembersOf;
  /** The history group of an item or of something without a page: gear by weapon type, artifact and armor piece, the rest alone. */
  readonly groupOf: (id: string) => string;
}

const SPAWNABLE = "sw.property.spawnable";
/** Tags every row of a table has in game without listing them. */
const IMPLIED: Readonly<Partial<Record<(typeof ITEM_TABLE_KEYS)[number], readonly string[]>>> = { artifact: ["sw.item.property.artifact"] };
/**
 * Items of one of these groups block each other in the recent-drop history of the Item slot. The data does not name the groups;
 * the third-party baseline matches only when armor is split by piece and weapons by melee/ranged (checked on the multi-draw
 * Soul Storm reward chests), so those are the groups.
 */
const HISTORY_GROUPS: readonly string[] = [
  "sw.item.property.meleeweapon",
  "sw.item.property.rangedweapon",
  "sw.item.property.artifact",
  "sw.item.property.armor.helmet",
  "sw.item.property.armor.chest",
  "sw.item.property.armor.leggings",
  "sw.item.property.armor.boots",
];

const ownTags = (row: ItemTagRow): string[] => (row.Traits?.GameplayTags ?? []).map((trait) => tagKey(trait.TagName));
const parentTags = (row: ItemTagRow): string[] => (row.Traits?.ParentTags ?? []).map((trait) => tagKey(trait.TagName));

/** The row's own tags and parents, plus those of every item row whose tag it carries, followed to the end (a loop is cut). */
function traitsOf(row: ItemTagRow, byTag: ReadonlyMap<string, ItemTagRow>): Set<string> {
  const visit = (current: ItemTagRow, seen: ReadonlySet<string>): string[] => [
    ...ownTags(current),
    ...parentTags(current),
    ...ownTags(current).flatMap((tag) => {
      const owner = byTag.get(tag);
      return owner && !seen.has(tag) ? visit(owner, new Set([...seen, tag])) : [];
    }),
  ];
  return new Set(visit(row, new Set([tagKey(row.TypeTag.TagName)])));
}

const RARITY_MASK: Readonly<Record<string, number>> = { "sw.rarity.common": 1, "sw.rarity.rare": 2, "sw.rarity.special": 4, "sw.rarity.unique": 8 };
/** Tables whose items roll a rarity when they drop. */
const ROLLS_RARITY: ReadonlySet<string> = new Set(["melee", "ranged", "armor", "artifact"]);

/**
 * The rarities an item can roll: those its row lists as PossibleRarities, else Common, Rare and Special, and Unique too when it
 * has a Unique variant to turn into. Books, talismans and currencies have no rarity.
 */
function allowedRarities(table: string, row: ItemTagRow, hasVariant: boolean): number | undefined {
  if (!ROLLS_RARITY.has(table)) return undefined;
  const limited = (row.KeyValues ?? []).find((value) => tagKey(value.TypeTag.TagName) === "sw.keyvalue.possiblerarities");
  const listed = (limited?.GameplayTagContainer?.GameplayTags ?? []).reduce((mask, rarity) => mask | (RARITY_MASK[tagKey(rarity.TagName)] ?? 0), 0);
  return listed > 0 ? listed : hasVariant ? 15 : 7;
}

export function buildUniverse(loot: LootTables, entries: readonly Entry[]): Universe {
  const find = entryIndex(entries);
  const rows = ITEM_TABLE_KEYS.flatMap((table) =>
    loot[table].filter((row) => !/^Base[A-Z]/.test(row.Name)).map((row) => ({ table, row })),
  );
  const byTag = new Map(rows.map(({ row }) => [tagKey(row.TypeTag.TagName), row] as const));
  const items = rows.flatMap(({ table, row }): UniverseItem[] => {
    const all = new Set([...traitsOf(row, byTag), ...(IMPLIED[table] ?? [])]);
    if (!all.has(SPAWNABLE)) return [];
    const entry = find(ITEM_TABLE_CATEGORY[table], locId(row.TypeTextData) ?? row.Name);
    const sub = row.UniqueSubstitutionData?.UniqueSubstitution?.TagName;
    const variant = sub !== undefined && sub !== "None" ? tagKey(sub) : undefined;
    const allowed = allowedRarities(table, row, variant !== undefined);
    return [{
      id: tagKey(row.TypeTag.TagName),
      ...(entry ? { key: `${ITEM_TABLE_CATEGORY[table]}/${entry.slug}` } : {}),
      all,
      ...(variant ? { sub: variant } : {}),
      ...(allowed === undefined ? {} : { allowed }),
    }];
  });
  const byId = new Map(items.map((item) => [item.id, item] as const));
  const membersOf: MembersOf = (tag) => {
    const key = tagKey(tag);
    return byId.has(key) ? [key] : items.filter((item) => item.all.has(key)).map((item) => item.id);
  };
  const groupOf = (id: string): string => HISTORY_GROUPS.find((group) => byId.get(id)?.all.has(group)) ?? id;
  return { items: byId, membersOf, groupOf };
}
