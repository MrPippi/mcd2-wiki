/** Hand-made item rows with the fields the drop odds read (parents, Unique substitution, possible rarities), validated by the real schema. */
import { ITEM_TABLE_KEYS, LootTablesSchema, type ItemTableKey, type LootTables } from "../../scripts/extract/loot-tables";

const tag = (TagName: string) => ({ TagName });
const tags = (names: readonly string[]) => ({ GameplayTags: names.map(tag) });

export interface GearOptions {
  readonly traits?: readonly string[];
  readonly parents?: readonly string[];
  /** Tag of the Unique variant. */
  readonly sub?: string;
  /** SW.Rarity.* tags the item is limited to. */
  readonly rarities?: readonly string[];
}

const TABLE_FILES: Readonly<Record<ItemTableKey, string>> = {
  melee: "DT_ItemDefinitionMelee",
  ranged: "DT_ItemDefinitionRanged",
  armor: "DT_ItemDefinitionArmor",
  artifact: "DT_ItemDefinitionArtifact",
  enchantmentBook: "DT_ItemDefinitionEnchantmentBook",
  talisman: "DT_ItemDefinitionTalisman",
};

/** An item row; pass SW.Property.Spawnable in `traits` for a real item (the default adds it). */
export function gear(table: ItemTableKey, name: string, typeTag: string, options: GearOptions = {}) {
  return {
    Name: name,
    TypeTag: tag(typeTag),
    Traits: { ...tags(options.traits ?? ["SW.Property.Spawnable"]), ParentTags: options.parents?.map(tag) ?? [] },
    TypeTextData: { Texts: { '(TagName="SW.TextEntry.Name")': { Text: `LOCTABLE("${TABLE_FILES[table]}.csv", "SW_Item_${name}_SW_TextEntry_Name")` } } },
    ...(options.sub ? { UniqueSubstitutionData: { UniqueSubstitution: tag(options.sub) } } : {}),
    ...(options.rarities ? { KeyValues: [{ TypeTag: tag("SW.KeyValue.PossibleRarities"), GameplayTagContainer: tags(options.rarities) }] } : {}),
  };
}

export const EMPTY_LOOT = { generic: [], mob: [], area: [], lootActor: [], quest: [], ...Object.fromEntries(ITEM_TABLE_KEYS.map((key) => [key, []])) };
export const dropLoot = (partial: Partial<Record<keyof LootTables, readonly unknown[]>>): LootTables => LootTablesSchema.parse({ ...EMPTY_LOOT, ...partial });
