/** The Soul Storm DataTable fields the extractor reads, validated so a game update fails loudly. Other fields pass through. */
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DATATABLES_DIR } from "./game-tables";
import { ExtractError, formatZodIssue } from "./issues";
import { LootTablesSchema } from "./loot-tables";
import { readDataTable } from "./table-reader";

export const SOUL_STORM_TABLE_FILES = {
  schedule: "DT_SoulStormTimeSchedule",
  rotation: "DT_SoulStormScheduleAreaRotation",
  props: "DT_SoulStormPropActorDefinition",
  spawns: "DT_SpawnDefinition",
  lootActor: "DT_LootSourceDefinition_LootActor",
  rarityChance: "DT_RarityChanceDefinition",
  gameBalance: "DT_GameBalanceDefinition",
} as const;

type TableKey = keyof typeof SOUL_STORM_TABLE_FILES;
const TABLE_KEYS = ["schedule", "rotation", "props", "spawns", "lootActor", "rarityChance", "gameBalance"] as const satisfies readonly TableKey[];

const Tag = z.looseObject({ TagName: z.string() });
const TagWeight = z.looseObject({ TypeTag: Tag, Weight: z.number(), Operation: z.string() });
const TagWeights = z.looseObject({ Tags: z.array(TagWeight).optional() });
const KeyValue = z.looseObject({ TypeTag: Tag, Type: z.string(), Int: z.number().optional(), Float: z.number().optional() });

const ScheduleRow = z.looseObject({
  Name: z.string(),
  TypeTag: Tag,
  Timestamp: z.string(),
  DurationInSeconds: z.number(),
  CadenceInSeconds: z.number(),
});
const RotationRow = z.looseObject({ Name: z.string(), TypeTag: Tag, AreaTags: z.array(Tag) });

const Ability = z.looseObject({
  AbilityCallsign: Tag.optional(),
  CommonKeyValues: z.array(KeyValue).optional(),
  InstanceData: z
    .array(
      z.looseObject({
        WaveArray: z.array(z.looseObject({ SpawnDefinition: Tag })).optional(),
        TagToSpawn: Tag.optional(),
        TargetAbilityCallsign: Tag.optional(),
        TimerDuration: z.number().optional(),
      }),
    )
    .optional(),
});
const Specialization = z.looseObject({
  AbilityCallsign: Tag,
  KeyValueSpecializations: z.array(z.looseObject({ KeyValue })).optional(),
  InstanceDataSpecializations: z.array(z.looseObject({ TimerDuration: z.number().optional() })).optional(),
});
const PropRow = z.looseObject({
  Name: z.string(),
  TypeTag: Tag,
  Traits: z.looseObject({ GameplayTags: z.array(Tag).optional() }).optional(),
  AttributeValues: z.array(z.looseObject({ Attribute: Tag, Value: z.number() })).optional(),
  TypeTextData: z.unknown().optional(),
  AttributeThresholds: z.looseObject({ Thresholds: z.array(z.looseObject({ Event: Tag, Value: z.number() })).optional() }).optional(),
  Abilities: z.array(Ability).optional(),
  AbilitySpecialization: z.looseObject({ Specializations: z.array(Specialization) }).optional(),
  MultiplayerScalingDefinitions: z
    .looseObject({ TagMap: z.record(z.string(), z.looseObject({ Multipliers: z.array(z.number()) })).optional() })
    .optional(),
});

const SpawnSlot = z.looseObject({
  SpawnTable: TagWeights.optional(),
  Conditions: z.array(z.looseObject({ DropTable: TagWeights.optional() })).optional(),
});
const SpawnRow = z.looseObject({
  Name: z.string(),
  TypeTag: Tag,
  SpawnDefinition: z.looseObject({ SpawnSlot: z.record(z.string(), SpawnSlot).optional() }).optional(),
});
const RarityChanceRow = z.looseObject({ Name: z.string(), TypeTag: Tag, TagList: TagWeights });
const GameBalanceRow = z.looseObject({
  Name: z.string(),
  TypeTag: Tag,
  Traits: z.unknown().optional(),
  SoulStormConstants: z.looseObject({ SoulStormEligibilityGamestate: Tag.optional() }).optional(),
});

export const SoulStormTablesSchema = z.object({
  schedule: z.array(ScheduleRow),
  rotation: z.array(RotationRow),
  props: z.array(PropRow),
  spawns: z.array(SpawnRow),
  lootActor: LootTablesSchema.shape.lootActor,
  rarityChance: z.array(RarityChanceRow),
  gameBalance: z.array(GameBalanceRow),
});
export type SoulStormTables = z.infer<typeof SoulStormTablesSchema>;
export type ScheduleRow = SoulStormTables["schedule"][number];
export type RotationRow = SoulStormTables["rotation"][number];
export type PropRow = SoulStormTables["props"][number];
export type SpawnRow = SoulStormTables["spawns"][number];
export type RarityChanceRow = SoulStormTables["rarityChance"][number];
export type GameBalanceRow = SoulStormTables["gameBalance"][number];

export interface LoadedSoulStormTables {
  readonly tables?: SoulStormTables;
  readonly missing: readonly string[];
}

const tablePath = (dir: string, key: TableKey): string => path.join(dir, `${SOUL_STORM_TABLE_FILES[key]}.json`);

/** Rows of one table, or undefined when its file is absent (the caller records it as missing). */
async function readOptional(dir: string, key: TableKey, onRead?: (file: string) => void): Promise<unknown[] | undefined> {
  if (!existsSync(tablePath(dir, key))) return undefined;
  return readDataTable(dir, SOUL_STORM_TABLE_FILES[key], onRead);
}

function parseTables(rowsByKey: Readonly<Record<TableKey, readonly unknown[]>>): SoulStormTables {
  const failures = TABLE_KEYS.flatMap((key) => {
    const parsed = SoulStormTablesSchema.shape[key].safeParse(rowsByKey[key]);
    return parsed.success
      ? []
      : [`資料表 ${SOUL_STORM_TABLE_FILES[key]}（${key}）欄位與預期不符（遊戲更新了格式？）：${parsed.error.issues.slice(0, 3).map(formatZodIssue).join("；")}`];
  });
  if (failures.length > 0) throw new ExtractError(failures.join("\n"));
  return SoulStormTablesSchema.parse(rowsByKey);
}

/** Reads the Soul Storm tables; `tables` is undefined when the schedule or rotation table is missing. */
export async function loadSoulStormTables(sourceRoot: string, onRead?: (file: string) => void): Promise<LoadedSoulStormTables> {
  const dir = path.join(sourceRoot, ...DATATABLES_DIR.split("/"));
  const [schedule, rotation, props, spawns, lootActor, rarityChance, gameBalance] = await Promise.all(TABLE_KEYS.map((key) => readOptional(dir, key, onRead)));
  const missing = TABLE_KEYS.filter((_, index) => [schedule, rotation, props, spawns, lootActor, rarityChance, gameBalance][index] === undefined).map(
    (key) => `${SOUL_STORM_TABLE_FILES[key]}.json`,
  );
  if (schedule === undefined || rotation === undefined) return { missing };
  const tables = parseTables({
    schedule, rotation, props: props ?? [], spawns: spawns ?? [], lootActor: lootActor ?? [], rarityChance: rarityChance ?? [], gameBalance: gameBalance ?? [],
  });
  return { tables, missing };
}
