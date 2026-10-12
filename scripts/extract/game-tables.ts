/** The few DataTable fields weapon extraction reads, validated so a game update that renames them fails loudly. */
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ExtractError, formatZodIssue } from "./issues";
import { readJsonFile } from "./read-json";

const Tag = z.object({ TagName: z.string() });
const Tags = z.object({ GameplayTags: z.array(Tag).optional() }).optional();
const Query = z.object({ TagDictionary: z.array(Tag), QueryTokenStream: z.array(z.number()) });
const TextEntry = z.object({
  Text: z.string(),
  DynamicDataGetterFunction: Tag.optional(),
  ValuesToGet: z
    .array(
      z.object({
        TagToExtractFrom: Tag.optional(),
        FormattingData: z
          .object({ IsPercentage: z.boolean(), Multiplier: z.number(), Offset: z.number(), MaxFractionalDigits: z.number() })
          .optional(),
      }),
    )
    .optional(),
});
const TextData = z.object({ Texts: z.record(z.string(), TextEntry) }).optional();
const Knockback = z.object({ Strength: z.number() }).optional();

/** A gameplay ability key value: only numbers are kept, other kinds (tags, containers) become undefined. */
const KeyValue = z.object({ TypeTag: Tag, Float: z.number().optional(), Int: z.number().optional(), Bool: z.boolean().optional() });
const Ability = z.object({
  Ability: z.string(),
  SpecificKeyValues: z.array(KeyValue).optional(),
  CommonKeyValues: z.array(KeyValue).optional(),
});
const ItemRow = z.object({ Name: z.string(), Traits: Tags, Effects: Tags, TypeTextData: TextData, KeyValues: z.array(KeyValue).optional() });
const MeleeRow = z.object({
  Name: z.string(),
  AttackVariants: z.object({
    Variants: z.array(
      z.object({ Damage: z.number(), Stagger: z.number(), AttackRange: z.number(), VariantLoopAmount: z.number(), Knockback }),
    ),
  }),
  JumpAttackDefinition: z
    .object({ Damage: z.number(), Stagger: z.number(), AreaOfEffectSplashRange: z.number(), Knockback })
    .optional(),
});
const RangedRow = z.object({
  Name: z.string(),
  AttackDefintion: z.object({
    Range: z.number(),
    MaxAmmo: z.number(),
    RechargeTimeSeconds: z.number(),
    AttackRateSeconds: z.number(),
    ChargeTimeSecond: z.number(),
    ChargeDamageMultiplier: z.number(),
    JumpshotDamageMultiplier: z.number(),
    ProjectileDamageFactor: z.number(),
    VolleyDefinitions: z.array(
      z.object({ ProjectileDefinitions: z.array(z.object({ ProjectileTypeTag: Tag, NumberOfProjectiles: z.number() })) }),
    ),
  }),
});
const ProjectileRow = z.object({
  TypeTag: Tag,
  ProjectileGameplayData: z.object({ damage: z.number(), Stagger: z.number(), knockback: Knockback }),
});
const TemplateRow = z.object({
  Name: z.string(),
  TypeTag: Tag,
  Traits: Tags,
  TemplateData: z.object({
    Effect: Tag.optional(),
    FixedEffectValue: z.number().optional(),
    IncompatibleTagsQuery: Query.optional(),
  }),
});
const WeightedTags = z.object({ Tags: z.array(z.object({ TypeTag: Tag })).optional() }).optional();
const GroupRow = z.object({ TypeTag: Tag, TagList: WeightedTags });
const DropRow = z.object({ TypeTag: Tag, PrimaryETG: WeightedTags, SecondaryETG: WeightedTags });
const NamedRow = z.object({ Name: z.string(), TypeTag: Tag, TypeTextData: TextData });
const EnchantmentRow = z.object({
  Name: z.string(),
  TypeTag: Tag,
  Traits: Tags,
  TypeTextData: TextData,
  TemplateData: z.object({ FixedEffectValue: z.number().optional() }).optional(),
  /** The gear slots the enchantment can go on. */
  EnchantmentData: z.object({ RelevantSlots: z.object({ GameplayTags: z.array(Tag).optional() }).optional() }).optional(),
  Abilities: z.array(Ability).optional(),
  AbilitySpecialization: z
    .object({
      Specializations: z
        .array(
          z.object({
            Ability: z.string(),
            KeyValueSpecializations: z.array(z.object({ KeyValue: KeyValue, ModOp: z.string() })).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export const GameTablesSchema = z.object({
  items: z.array(ItemRow),
  melee: z.array(MeleeRow),
  ranged: z.array(RangedRow),
  projectiles: z.array(ProjectileRow),
  templates: z.array(TemplateRow),
  groups: z.array(GroupRow),
  dropTable: z.array(DropRow),
  effects: z.array(NamedRow),
  enchantments: z.array(EnchantmentRow),
  artifacts: z.array(ItemRow),
});
export type GameTables = z.infer<typeof GameTablesSchema>;
export type TextDataValue = z.infer<typeof TextData>;
export type EnchantmentRowValue = z.infer<typeof EnchantmentRow>;
export type AbilityValue = z.infer<typeof Ability>;

/** DataTables copied from the export's Content/Spicewood/Core/DataTables, beside Localization in source-data. */
export const DATATABLES_DIR = "DataTables/UFS";

const FILES: Readonly<Record<keyof GameTables, readonly string[]>> = {
  items: ["DT_ItemDefinitionMelee", "DT_ItemDefinitionRanged"],
  melee: ["DT_MeleePropertyDefinition"],
  ranged: ["DT_RangedPropertyDefinition"],
  projectiles: ["DT_ProjectileDefinition"],
  templates: ["DT_EffectTemplateDefinition"],
  groups: ["DT_EffectTemplateGroupDefinition"],
  dropTable: ["DT_EffectTemplateGroupDropTableDefinition"],
  effects: ["DT_EffectDefinition"],
  enchantments: ["DT_EnchantmentDefinition"],
  artifacts: ["DT_ItemDefinitionArtifact"],
};

/** Reads the weapon tables; undefined when source-data has no DataTables folder (weapon data is then left out). */
export async function loadGameTables(sourceRoot: string): Promise<GameTables | undefined> {
  const dir = path.join(sourceRoot, ...DATATABLES_DIR.split("/"));
  if (!existsSync(dir)) return undefined;
  const readTable = async (name: string): Promise<unknown[]> => {
    const rows = await readJsonFile(path.join(dir, `${name}.json`), `資料表 ${name}`);
    if (!Array.isArray(rows)) throw new ExtractError(`資料表 ${name} 不存在或不是陣列：${dir}`);
    // Base* rows (BaseMeleeWeapon, BaseRanged, BaseProjectile…) are templates other rows inherit from, not items.
    return rows.filter((row) => !/^Base[A-Z]/.test(String((row as { Name?: unknown }).Name ?? "")));
  };
  const raw = Object.fromEntries(
    await Promise.all(
      Object.entries(FILES).map(async ([key, names]) => [key, (await Promise.all(names.map(readTable))).flat()] as const),
    ),
  );
  const parsed = GameTablesSchema.safeParse(raw);
  if (!parsed.success) throw new ExtractError(`資料表欄位與預期不符（遊戲更新了格式？）：${parsed.error.issues.slice(0, 3).map(formatZodIssue).join("；")}`);
  return parsed.data;
}
