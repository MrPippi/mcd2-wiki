/** Builds src/data/soul-storm.json: the schedule, the area rotation, the fight (generators, chests, unlock) and the game's own texts. */
import path from "node:path";
import type { BestiaryLinks } from "./bestiary";
import type { Lang } from "../../shared/config";
import { ExtractError, formatZodIssue, issue, type Issue } from "./issues";
import type { MapData } from "../../shared/map-schema";
import { areaMarkers } from "./mob-areas";
import { readJsonFile } from "./read-json";
import type { LocaleFile } from "../../shared/schemas";
import { buildChests, buildGenerators, chestRarity, unlockOf } from "./soul-storm-combat";
import { buildRotation, buildSchedule } from "./soul-storm-schedule-data";
import {
  EMPTY_SOUL_STORM,
  SoulStormDataSchema,
  SoulStormStatusSchema,
  type SoulStormData,
  type SoulStormStatus,
} from "../../shared/soul-storm-schema";
import { buildSoulStormTexts } from "./soul-storm-texts";
import { loadSoulStormTables, type SoulStormTables } from "./soul-storm-tables";

export const SOUL_STORM_ICON_SOURCES: Readonly<Record<"header" | "generator", string>> = {
  header: "Plugins/SpicewoodUI/Content/Spicewood/UI/Widget/SoulStorm/T_UI_soulstorm_icon_tmp.png",
  generator: "Plugins/SpicewoodUI/Content/Spicewood/UI/Texture/WorldMap/Icons/T_UI_Icon_Storminator.png",
};

export interface SoulStormInput {
  readonly sourceRoot: string;
  readonly locales: Readonly<Record<Lang, LocaleFile>>;
  readonly map: MapData;
  readonly links: BestiaryLinks;
  /** planAssets(...).paths: the published path of each icon that exists. */
  readonly icons: Readonly<Record<string, string>>;
  readonly statusPath: string;
}

export interface SoulStormResult {
  readonly data: SoulStormData;
  readonly issues: Issue[];
  readonly tablesRead: readonly string[];
}

/** The hand-kept status file; a missing or malformed file stops the extract, naming the file. */
async function readStatus(statusPath: string): Promise<SoulStormStatus> {
  const name = path.basename(statusPath);
  const raw = await readJsonFile(statusPath, name);
  if (raw === undefined) throw new ExtractError(`找不到 Soul Storm 狀態檔 ${name}：${statusPath}`);
  const parsed = SoulStormStatusSchema.safeParse(raw);
  if (!parsed.success) throw new ExtractError(`Soul Storm 狀態檔 ${name} 格式不符：${parsed.error.issues.map(formatZodIssue).join("；")}`);
  return parsed.data;
}

const iconsOf = (icons: Readonly<Record<string, string>>): SoulStormData["icons"] => ({
  ...(icons.header === undefined ? {} : { header: icons.header }),
  ...(icons.generator === undefined ? {} : { generator: icons.generator }),
});

function firstRow<Row>(rows: readonly Row[], label: string): Row {
  const row = rows[0];
  if (row === undefined) throw new ExtractError(`Soul Storm 資料表 ${label} 沒有任何資料列（遊戲更新了格式？）`);
  return row;
}

function buildFull(tables: SoulStormTables, input: SoulStormInput, status: SoulStormStatus): { data: Omit<SoulStormData, "texts" | "icons" | "verified">; issues: Issue[] } {
  const rotation = buildRotation(firstRow(tables.rotation, "DT_SoulStormScheduleAreaRotation"), input.links.areas, input.locales, areaMarkers(input.map));
  const generators = buildGenerators(tables, input.links.tagIndex);
  const hard = generators.generators.find((generator) => generator.tier === "hard");
  const unlock = unlockOf(tables.gameBalance);
  const chests = buildChests(tables.lootActor);
  const rarity = chestRarity(tables.rarityChance);
  return {
    data: {
      schedule: buildSchedule(firstRow(tables.schedule, "DT_SoulStormTimeSchedule"), status),
      rotation: rotation.rotation,
      rotationUntranslated: rotation.untranslated,
      unlock: unlock.unlock,
      generators: generators.generators,
      resistances: generators.resistances,
      shieldHealth: generators.shieldHealth,
      chests: chests.chests,
      chestRarity: rarity.rarity,
      monstrosities: hard?.finalSummon.mobs ?? [],
    },
    issues: [...rotation.issues, ...generators.issues, ...unlock.issues, ...chests.issues, ...rarity.issues],
  };
}

export async function extractSoulStorm(input: SoulStormInput): Promise<SoulStormResult> {
  const status = await readStatus(input.statusPath);
  const tablesRead: string[] = [];
  const loaded = await loadSoulStormTables(input.sourceRoot, (file) => {
    tablesRead.push(file);
  });
  const texts = buildSoulStormTexts(input.locales);
  const missing = loaded.missing.length > 0 ? [issue("missing-soul-storm-tables", loaded.missing.join(", "))] : [];
  const common = { verified: status.verified, texts: texts.texts, icons: iconsOf(input.icons) };
  if (loaded.tables === undefined) {
    return { data: SoulStormDataSchema.parse({ ...EMPTY_SOUL_STORM, ...common }), issues: [...missing, ...texts.issues], tablesRead };
  }
  const full = buildFull(loaded.tables, input, status);
  return {
    data: SoulStormDataSchema.parse({ ...common, ...full.data }),
    issues: [...missing, ...full.issues, ...texts.issues],
    tablesRead,
  };
}
