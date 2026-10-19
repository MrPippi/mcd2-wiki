/** The DataTable fields the mechanics guides read, validated so a game update fails loudly. Other fields pass through. */
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DATATABLES_DIR } from "./game-tables";
import { ExtractError, formatZodIssue } from "./issues";
import { LootTablesSchema } from "./loot-tables";
import { readDataTable } from "./table-reader";

export const GUIDE_TABLE_FILES = {
  player: "DT_PlayerDefinition",
  npcs: "DT_NPCDefinition",
  rarity: "DT_RarityDefinition",
  rarityChance: "DT_RarityChanceDefinition",
  progression: "DT_ProgressionDefinition",
  areas: "DT_AreaDefinition",
  collections: "DT_ItemCollectionsDefinition",
  talismans: "DT_ItemDefinitionTalisman",
  lootActor: "DT_LootSourceDefinition_LootActor",
  questLoot: "DT_LootSourceDefinition_Quest",
  quests: "DT_QuestLibraries",
  enchantments: "DT_EnchantmentDefinition",
  gameBalance: "DT_GameBalanceDefinition",
  difficulty: "DT_DifficultyDefinition",
  worldActor: "DT_WorldActorDefinition",
} as const;

type TableKey = keyof typeof GUIDE_TABLE_FILES;
const TABLE_KEYS = Object.keys(GUIDE_TABLE_FILES) as TableKey[];

const Tag = z.looseObject({ TagName: z.string() });
const Tags = z.looseObject({ GameplayTags: z.array(Tag).optional() });
const TextData = z.looseObject({ Texts: z.record(z.string(), z.looseObject({ Text: z.string() })) });
const KeyValue = z.looseObject({ TypeTag: Tag, Type: z.string(), Int: z.number().optional(), Float: z.number().optional() });

const EnchantCostEntry = z.looseObject({
  SpringStoneCost: z.number(),
  SpringStoneAdditionalCostPerLevel: z.number(),
  EnchantmentPointCost: z.number(),
  EnchantmentPointAdditionalCostPerLevel: z.number(),
});
const InstanceData = z.looseObject({
  EnchantCostMap: z.record(z.string(), EnchantCostEntry).optional(),
  UpgradeCosts: z.record(z.string(), z.looseObject({ LevelToCostMap: z.record(z.string(), z.number()) })).optional(),
});
const PlayerRow = z.looseObject({
  Name: z.string(),
  AttributeValues: z.array(z.looseObject({ Attribute: Tag, Value: z.number() })).optional(),
  Abilities: z.array(z.looseObject({ Ability: z.string(), InstanceData: z.array(InstanceData).optional() })).optional(),
});
const NpcRow = z.looseObject({ Name: z.string(), TypeTag: Tag, KeyValues: z.array(KeyValue).optional() });
const RarityRow = z.looseObject({
  Name: z.string(),
  TypeTag: Tag,
  RarityDefinition: z.looseObject({
    NumberOfEffectsData: z.looseObject({
      BaseNumberOfRerollableEffects: z.number(),
      AdditionalEffectChances: z.record(z.string(), z.number()).optional(),
    }),
    ItemPowerGenerationOffset: z.number(),
  }),
});
const RarityChanceRow = z.looseObject({
  Name: z.string(),
  TypeTag: Tag,
  TagList: z.looseObject({ Tags: z.array(z.looseObject({ TypeTag: Tag, Weight: z.number(), Operation: z.string() })).optional() }),
});
const ProgressionRow = z.looseObject({ Name: z.string(), TypeTag: Tag, ProgressionData: z.looseObject({ PlayerLevel: z.number() }) });
const AreaRow = z.looseObject({ Name: z.string(), TypeTag: Tag, TypeTextData: TextData.optional() });
const CollectionRow = z.looseObject({
  Name: z.string(),
  CollectionDefinition: z.looseObject({ ItemsInCollection: Tags.optional() }).optional(),
  TypeTextData: TextData.optional(),
});
const QuestLibraryRow = z.looseObject({ Name: z.string(), RawQuestData: z.string().optional() });
const EnchantmentRow = z.looseObject({ Name: z.string(), TypeTag: Tag });
/** A reference to a CurveTable row; the game writes "None" for no curve. */
const CurveRef = z.looseObject({ CurveTable: z.string(), RowName: z.string() });
const GameBalanceRow = z.looseObject({
  Name: z.string(),
  GameBalanceDefinition: z.looseObject({
    GlobalDifficultyScalingSettings: z.looseObject({ OutgoingDamageModifierCurve: CurveRef, IncomingDamageModifierCurve: CurveRef }).optional(),
    CharacterLevelsPerThreat: z.number().optional(),
  }).optional(),
  ItemCreatorConstants: z.looseObject({
    RarityChanceMap: z.record(z.string(), CurveRef).optional(),
    EffectChanceScalingCurves: z.record(z.string(), CurveRef).optional(),
  }).optional(),
});
const DifficultyRow = z.looseObject({
  Name: z.string(),
  TypeTag: Tag,
  DifficultyDefinition: z.looseObject({
    DifficultyScalar: z.number(),
    DifficultyCurveIncomingDamage: CurveRef,
    DifficultyCurveOutgoingDamage: CurveRef,
  }),
  TypeTextData: TextData.optional(),
});
const WorldActorRow = z.looseObject({
  Name: z.string(),
  AdditionalAssets: z.looseObject({ Assets: z.array(z.looseObject({ Name: z.string(), Object: z.string() })) }).optional(),
});

export const GuideTablesSchema = z.object({
  player: z.array(PlayerRow),
  npcs: z.array(NpcRow),
  rarity: z.array(RarityRow),
  rarityChance: z.array(RarityChanceRow),
  progression: z.array(ProgressionRow),
  areas: z.array(AreaRow),
  collections: z.array(CollectionRow),
  talismans: LootTablesSchema.shape.talisman,
  lootActor: LootTablesSchema.shape.lootActor,
  questLoot: LootTablesSchema.shape.quest,
  quests: z.array(QuestLibraryRow),
  enchantments: z.array(EnchantmentRow),
  gameBalance: z.array(GameBalanceRow),
  difficulty: z.array(DifficultyRow),
  worldActor: z.array(WorldActorRow),
});
export type GuideTables = z.infer<typeof GuideTablesSchema>;
export type PlayerRow = GuideTables["player"][number];
export type AreaRow = GuideTables["areas"][number];
export type GameBalanceRow = GuideTables["gameBalance"][number];
export type DifficultyRow = GuideTables["difficulty"][number];
export type TextDataValue = z.infer<typeof TextData>;

export interface LoadedGuideTables {
  readonly tables: GuideTables;
  /** File names of the tables that were absent; their parts of the guides stay empty. */
  readonly missing: readonly string[];
}

const tablePath = (dir: string, key: TableKey): string => path.join(dir, `${GUIDE_TABLE_FILES[key]}.json`);

async function readOptional(dir: string, key: TableKey, onRead?: (file: string) => void): Promise<unknown[] | undefined> {
  if (!existsSync(tablePath(dir, key))) return undefined;
  return readDataTable(dir, GUIDE_TABLE_FILES[key], { onRead });
}

/** Validates every table at once so one run names every changed table. */
export function parseGuideTables(rowsByKey: Readonly<Record<TableKey, readonly unknown[]>>): GuideTables {
  const failures = TABLE_KEYS.flatMap((key) => {
    const parsed = GuideTablesSchema.shape[key].safeParse(rowsByKey[key]);
    return parsed.success
      ? []
      : [`資料表 ${GUIDE_TABLE_FILES[key]}（${key}）欄位與預期不符（遊戲更新了格式？）：${parsed.error.issues.slice(0, 3).map(formatZodIssue).join("；")}`];
  });
  if (failures.length > 0) throw new ExtractError(failures.join("\n"));
  return GuideTablesSchema.parse(rowsByKey);
}

/** Reads the guide tables; a missing table reads as empty and is listed in `missing`. */
export async function loadGuideTables(sourceRoot: string, onRead?: (file: string) => void): Promise<LoadedGuideTables> {
  const dir = path.join(sourceRoot, ...DATATABLES_DIR.split("/"));
  const read = await Promise.all(TABLE_KEYS.map(async (key) => [key, await readOptional(dir, key, onRead)] as const));
  const missing = read.filter(([, rows]) => rows === undefined).map(([key]) => `${GUIDE_TABLE_FILES[key]}.json`);
  const rowsByKey = Object.fromEntries(read.map(([key, rows]) => [key, rows ?? []])) as Record<TableKey, unknown[]>;
  return { tables: parseGuideTables(rowsByKey), missing };
}
