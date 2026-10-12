import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { ALL_LANGS, LANG_META } from "../../scripts/extract/config";
import { runExtract } from "../../scripts/extract/pipeline";
import { SOUL_STORM_ICON_SOURCES } from "../../scripts/extract/soul-storm";
import { SoulStormDataSchema } from "../../scripts/extract/soul-storm-schema";
import { SOUL_STORM_TABLE_FILES } from "../../scripts/extract/soul-storm-tables";
import { ns } from "../helpers/locales";
import { REAL_BALANCE, REAL_CHESTS, REAL_GENERATORS, REAL_RARITY, REAL_SPAWNS, rotationRow, scheduleRow } from "../helpers/soul-storm-tables";

const SECRET = "0123456789abcdef0123456789abcdef";   // fake telemetry key
/** The weapon tables loadGameTables insists on once a DataTables folder exists. */
const WEAPON_TABLES = [
  "DT_ItemDefinitionMelee", "DT_ItemDefinitionRanged", "DT_MeleePropertyDefinition", "DT_RangedPropertyDefinition", "DT_ProjectileDefinition",
  "DT_EffectTemplateDefinition", "DT_EffectTemplateGroupDefinition", "DT_EffectTemplateGroupDropTableDefinition", "DT_EffectDefinition",
  "DT_EnchantmentDefinition", "DT_ItemDefinitionArtifact", "DT_ItemDefinitionArmor",
];
let sourceRoot: string;
let outRoot: string;
let overridesPath: string;
let statusPath: string;

async function putJson(relative: string, value: unknown): Promise<void> {
  const file = path.join(sourceRoot, ...relative.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value), "utf8");
}
const putTable = (name: string, rows: unknown): Promise<void> => putJson(`DataTables/UFS/${name}.json`, rows);

async function putPng(relative: string): Promise<void> {
  const file = path.join(sourceRoot, ...relative.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  await sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }).png().toFile(file);
}

beforeEach(async () => {
  sourceRoot = await mkdtemp(path.join(tmpdir(), "mcd2-sssrc-"));
  outRoot = await mkdtemp(path.join(tmpdir(), "mcd2-ssout-"));
  overridesPath = path.join(sourceRoot, "overrides.json");
  statusPath = path.join(sourceRoot, "soul-storm-status.json");
  await writeFile(overridesPath, "{}", "utf8");
  await writeFile(statusPath, JSON.stringify({ verified: false, anchorOffsetMinutes: 0, rotationOffset: 0 }), "utf8");
  const title = { [ns("OnboardingLabels")]: { tutoriallog_soulstorms_title: "Soul Storms" } };
  await Promise.all(ALL_LANGS.map((lang) => putJson(`Localization/All/${LANG_META[lang].culture}/All.json`, lang === "en" ? title : {})));
  await putTable("OnlineConstants", { ApiKey: SECRET });
  await Promise.all(WEAPON_TABLES.map((name) => putTable(name, [])));
  await putTable(SOUL_STORM_TABLE_FILES.schedule, [scheduleRow()]);
  await putTable(SOUL_STORM_TABLE_FILES.rotation, [rotationRow()]);
  await putTable(SOUL_STORM_TABLE_FILES.props, REAL_GENERATORS());
  await putTable(SOUL_STORM_TABLE_FILES.spawns, REAL_SPAWNS());
  await putTable(SOUL_STORM_TABLE_FILES.lootActor, REAL_CHESTS());
  await putTable(SOUL_STORM_TABLE_FILES.rarityChance, REAL_RARITY());
  await putTable(SOUL_STORM_TABLE_FILES.gameBalance, REAL_BALANCE());
  await putPng(SOUL_STORM_ICON_SOURCES.generator);
});

describe("runExtract with Soul Storm tables", () => {
  it("writes a valid soul-storm.json with the seven-area rotation and the generator icon", async () => {
    const summary = await runExtract({ sourceRoot, outRoot, overridesPath, soulStormStatusPath: statusPath });
    const data = SoulStormDataSchema.parse(JSON.parse(await readFile(path.join(outRoot, "src", "data", "soul-storm.json"), "utf8")));
    expect(data.rotation).toHaveLength(7);
    expect(data.generators.map((generator) => generator.tier)).toEqual(["easy", "medium", "hard"]);
    expect(data.icons).toEqual({ generator: "icons/soul-storm/generator.png" });
    expect(existsSync(path.join(outRoot, "public", "icons", "soul-storm", "generator.png"))).toBe(true);
    expect(summary.issues.map((item) => item.type)).toContain("missing-ui-icon");   // the header icon is not in this source
    const report = await readFile(path.join(outRoot, "extract-report.md"), "utf8");
    expect(report).toContain("soul-storm");
  });

  it("lists the Soul Storm tables it read and never the telemetry constants or their key", async () => {
    const summary = await runExtract({ sourceRoot, outRoot, overridesPath, soulStormStatusPath: statusPath });
    expect(summary.tablesRead).toContain("DT_SoulStormTimeSchedule.json");
    expect(summary.tablesRead.some((file) => /constants/i.test(file))).toBe(false);
    expect(await readFile(path.join(outRoot, "src", "data", "soul-storm.json"), "utf8")).not.toContain(SECRET);
  });

  it("falls back to the status file next to the icon overrides", async () => {
    await runExtract({ sourceRoot, outRoot, overridesPath });
    const data = SoulStormDataSchema.parse(JSON.parse(await readFile(path.join(outRoot, "src", "data", "soul-storm.json"), "utf8")));
    expect(data.verified).toBe(false);
  });
});
