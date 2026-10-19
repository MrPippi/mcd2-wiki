import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { MapDataSchema } from "../../../shared/map-schema";
import { extractSoulStorm, type SoulStormInput } from "../../../scripts/extract/soul-storm";
import { SOUL_STORM_TABLE_FILES } from "../../../scripts/extract/soul-storm-tables";
import { makeLocales } from "../../helpers/locales";
import { REAL_BALANCE, REAL_CHESTS, REAL_GENERATORS, REAL_RARITY, REAL_SPAWNS, rotationRow, scheduleRow } from "../../helpers/soul-storm-tables";

let sourceRoot: string;
let statusPath: string;

async function put(relative: string, value: unknown): Promise<void> {
  const file = path.join(sourceRoot, ...relative.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value), "utf8");
}
const putTable = (name: string, rows: unknown): Promise<void> => put(`DataTables/UFS/${name}.json`, rows);
const writeStatus = (value: unknown): Promise<void> => writeFile(statusPath, JSON.stringify(value), "utf8");

const TAG_INDEX = new Map([
  ["sw.mob.monstrosity.copper.storm", "monstrosity-copper"], ["sw.mob.monstrosity.redstone.storm", "monstrosity-red-stone"],
  ["sw.mob.monstrosity.sculk.storm", "monstrosity-sculk"], ["sw.mob.zombie.soulstated", "zombie"],
]);
const locales = makeLocales({ "Text/Release/OnboardingLabels.csv": { tutoriallog_soulstorms_title: { en: "Soul Storms", zh: "靈魂風暴" } } });
const input = (): SoulStormInput => ({
  sourceRoot, locales, map: MapDataSchema.parse({ worlds: [], legend: {} }), links: { tagIndex: TAG_INDEX, areas: [] },
  icons: { generator: "icons/soul-storm/generator.png" }, statusPath,
});

beforeEach(async () => {
  sourceRoot = await mkdtemp(path.join(tmpdir(), "mcd2-ss-"));
  statusPath = path.join(sourceRoot, "soul-storm-status.json");
  await writeStatus({ verified: false, anchorOffsetMinutes: 0, rotationOffset: 0 });
  await putTable(SOUL_STORM_TABLE_FILES.schedule, [scheduleRow()]);
  await putTable(SOUL_STORM_TABLE_FILES.rotation, [rotationRow()]);
  await putTable(SOUL_STORM_TABLE_FILES.props, REAL_GENERATORS());
  await putTable(SOUL_STORM_TABLE_FILES.spawns, REAL_SPAWNS());
  await putTable(SOUL_STORM_TABLE_FILES.lootActor, REAL_CHESTS());
  await putTable(SOUL_STORM_TABLE_FILES.rarityChance, REAL_RARITY());
  await putTable(SOUL_STORM_TABLE_FILES.gameBalance, REAL_BALANCE());
  await putTable("OnlineConstants", { ApiKey: "0123456789abcdef0123456789abcdef" });
});

describe("extractSoulStorm", () => {
  it("copies verified from the status file, false and true", async () => {
    expect((await extractSoulStorm(input())).data.verified).toBe(false);
    await writeStatus({ verified: true, anchorOffsetMinutes: 0, rotationOffset: 0 });
    expect((await extractSoulStorm(input())).data.verified).toBe(true);
  });

  it("carries the status offsets into the schedule", async () => {
    await writeStatus({ verified: false, anchorOffsetMinutes: 480, rotationOffset: 3 });
    const { data } = await extractSoulStorm(input());
    expect(data.schedule).toMatchObject({ anchorOffsetMinutes: 480, rotationOffset: 3, durationSeconds: 1200, cadenceSeconds: 2400 });
  });

  it("derives the monstrosities from the Hard final summon", async () => {
    const { data } = await extractSoulStorm(input());
    expect(data.monstrosities).toEqual(data.generators[2].finalSummon.mobs);
    expect(data.monstrosities).toEqual(["monstrosity-copper", "monstrosity-red-stone", "monstrosity-sculk"]);
    expect(data.rotation).toHaveLength(7);
    expect(data.chests).toHaveLength(6);
    expect(data.unlock).toEqual({ gameState: "SW.GameState.MainQuestComplete" });
    expect(data.icons).toEqual({ generator: "icons/soul-storm/generator.png" });
  });

  it("gives the empty page data, with texts and icons, when the schedule table is missing", async () => {
    const bare = await mkdtemp(path.join(tmpdir(), "mcd2-ssbare-"));
    await writeFile(path.join(bare, "status.json"), JSON.stringify({ verified: true, anchorOffsetMinutes: 0, rotationOffset: 0 }), "utf8");
    const result = await extractSoulStorm({ ...input(), sourceRoot: bare, statusPath: path.join(bare, "status.json") });
    expect(result.data).toMatchObject({ verified: true, rotation: [], generators: [], chests: [], monstrosities: [], icons: { generator: "icons/soul-storm/generator.png" } });
    expect(result.data.texts.title.html.zh).toBe("靈魂風暴");
    expect(result.issues.map((item) => item.type)).toContain("missing-soul-storm-tables");
    expect(result.tablesRead).toEqual([]);
  });

  it("stops with the file name when the status file is malformed or absent", async () => {
    await writeStatus({ verified: "no", anchorOffsetMinutes: 0, rotationOffset: 0 });
    await expect(extractSoulStorm(input())).rejects.toThrow(/soul-storm-status\.json/);
    await expect(extractSoulStorm({ ...input(), statusPath: path.join(sourceRoot, "nope.json") })).rejects.toThrow(/nope\.json/);
  });

  it("lists the tables it read and never the telemetry constants", async () => {
    const { tablesRead } = await extractSoulStorm(input());
    expect(tablesRead).toContain("DT_SoulStormTimeSchedule.json");
    expect(tablesRead.some((file) => /constants/i.test(file))).toBe(false);
  });
});
