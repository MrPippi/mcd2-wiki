/** Small hand-made mob and loot DataTable rows in the game's export shape. Every builder output is validated by the real schema. */
import { LootTablesSchema, type LootTables } from "../../scripts/extract/loot-tables";
import { MobTablesSchema, type MobTables } from "../../scripts/extract/mob-tables";

const tag = (TagName: string) => ({ TagName });
export const tags = (...names: string[]) => ({ GameplayTags: names.map(tag) });
const nameText = (table: string, key: string) => ({
  Texts: { '(TagName="SW.TextEntry.Name")': { Text: `LOCTABLE("${table}.csv", "${key}")` } },
});

export interface MobOptions {
  readonly key?: string;            // name key; default SW_Mob_<Name>_SW_TextEntry_Name
  readonly traits?: readonly string[];
  readonly attrs?: Readonly<Record<string, number>>;  // "Health" -> SW.Attribute.Health
  readonly reference?: string;      // CharacterReference
  readonly variants?: readonly string[];              // Variants.Replacements tags
  readonly unnamed?: boolean;
}

export function mobRow(table: string, name: string, typeTag: string, options: MobOptions = {}) {
  return {
    Name: name,
    TypeTag: tag(typeTag),
    Traits: tags(...(options.traits ?? [])),
    CharacterReference: options.reference ?? `/Game/Art/Characters/${name}/BP_${name}.BP_${name}_C`,
    AttributeValues: Object.entries(options.attrs ?? {}).map(([attribute, Value]) => ({ Attribute: tag(`SW.Attribute.${attribute}`), Value })),
    ...(options.unnamed ? {} : { TypeTextData: nameText(table, options.key ?? `SW_Mob_${name}_SW_TextEntry_Name`) }),
    ...(options.variants ? { Variants: { Replacements: options.variants.map((variant) => ({ TypeTagToUseInstead: tag(variant), Weight: 0.2 })) } } : {}),
  };
}

export const areaRow = (name: string, typeTag: string, mobs: readonly string[], key?: string) => ({
  Name: name,
  TypeTag: tag(typeTag),
  TypeTextData: nameText("DT_AreaDefinition", key ?? `SW_Area_${name}_SW_TextEntry_Name`),
  AreaDefinition: { ConditionGroups: [{ DefaultDefinition: { MobTypes: mobs.map((mob) => ({ MobType: tag(mob) })) } }] },
});

export const waveRow = (name: string, mobs: readonly string[]) => ({
  Name: name,
  SpawnWaveDefinition: { Waves: [{ Waves: mobs.map((mob) => ({ MobType: tag(mob) })) }] },
});

const EMPTY_MOBS = { definitions: [], type1: [], type2: [], type3: [], soulStated: [], variants: [], areas: [], waves: [] };
export const mobTables = (partial: Partial<Record<keyof MobTables, readonly unknown[]>>): MobTables =>
  MobTablesSchema.parse({ ...EMPTY_MOBS, ...partial });

/** A pool entry: a tag (Set, weight 1) or [tag, weight, operation]. */
export type PoolTag = string | readonly [string, number, "Set" | "Multiply"];
export function slot(name: string, guaranteed: number, rolls: number, chance: number, inherit: boolean, pool: readonly PoolTag[] = []) {
  return [
    `(TagName="${name === "" ? "" : `SW.LootSlot.${name}`}")`,
    {
      NumberOfGuaranteedDrops: guaranteed,
      NumberOfRandomRolls: rolls,
      DropChancePerRoll: chance,
      InheritParentDropTable: inherit,
      DropTable: pool.length === 0 ? {} : { Tags: pool.map((entry) => {
        const [name2, Weight, Operation] = typeof entry === "string" ? [entry, 1, "Set"] : entry;
        return { TypeTag: tag(name2), Weight, Operation };
      }) },
    },
  ] as const;
}

export const lootRow = (name: string, typeTag: string, slots: readonly ReturnType<typeof slot>[], traits: readonly string[] = []) => ({
  Name: name,
  TypeTag: tag(typeTag),
  ...(traits.length > 0 ? { Traits: tags(...traits) } : {}),
  LootDropDefinition: { LootSlots: Object.fromEntries(slots) },
});

export const itemRow = (table: string, name: string, typeTag: string, traits: readonly string[] = [], idKey?: string) => ({
  Name: name,
  TypeTag: tag(typeTag),
  Traits: tags(...traits),
  TypeTextData: nameText(table, idKey ?? `SW_Item_${name}_SW_TextEntry_Name`),
});

const EMPTY_LOOT = { generic: [], mob: [], area: [], lootActor: [], quest: [], melee: [], ranged: [], armor: [], artifact: [], enchantmentBook: [], talisman: [] };
export const lootTables = (partial: Partial<Record<keyof LootTables, readonly unknown[]>>): LootTables =>
  LootTablesSchema.parse({ ...EMPTY_LOOT, ...partial });
