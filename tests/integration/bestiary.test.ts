import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { extractBestiary } from "../../scripts/extract/bestiary";
import { MapDataSchema } from "../../scripts/extract/map-schema";
import { makeEntry } from "../helpers/entries";
import { makeLocales, ns } from "../helpers/locales";
import { areaRow, itemRow, lootRow, mobRow, slot, waveRow } from "../helpers/mob-tables";

const SECRET = "0123456789abcdef0123456789abcdef";   // fake telemetry key
let sourceRoot: string;
let outRoot: string;
let overrideDir: string;

async function putJson(relative: string, value: unknown): Promise<void> {
  const file = path.join(sourceRoot, ...relative.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value), "utf8");
}

const T = (name: string) => `DataTables/UFS/${name}.json`;
const locales = makeLocales({
  [ns("DT_MobType1Definition")]: { SW_Mob_Zombie_SW_TextEntry_Name: { en: "Zombie", zh: "殭屍" }, SW_Mob_Bee_SW_TextEntry_Name: { en: "Bee", zh: "蜜蜂" } },
  [ns("DT_MobType3Definition")]: { SW_Mob_Maw_SW_TextEntry_Name: { en: "Twisted Warden", zh: "扭曲守護者" } },
  [ns("DT_AreaDefinition")]: { SW_Area_Plains_A1_SW_TextEntry_Name: { en: "Creeper Woods", zh: "苦力怕森林" } },
});
const map = MapDataSchema.parse({ worlds: [], legend: {} });

beforeEach(async () => {
  sourceRoot = await mkdtemp(path.join(tmpdir(), "mcd2-bsrc-"));
  outRoot = await mkdtemp(path.join(tmpdir(), "mcd2-bout-"));
  overrideDir = path.join(outRoot, "overrides");
  await putJson(T("OnlineConstants"), { ApiKey: SECRET, Nested: { token: "zzzzzzzzzzzzzzzzzzzzzzzz" } });
  await putJson(T("DT_MobType1Definition"), [
    mobRow("DT_MobType1Definition", "Zombie", "SW.Mob.Zombie", { traits: ["SW.Mob.Type1", "SW.Mob.Default.Hostile"], attrs: { Health: 8 } }),
    mobRow("DT_MobType1Definition", "Bee", "SW.Mob.Bee", { traits: ["SW.Mob.Type1", "SW.Mob.Default.Hostile"], attrs: { Health: 4 } }),
  ]);
  await putJson(T("DT_MobType3Definition"), [mobRow("DT_MobType3Definition", "Maw", "SW.Mob.Maw", { traits: ["SW.Trait.Boss", "SW.Mob.Default.Hostile"] })]);
  await putJson(T("DT_AreaDefinition"), [areaRow("Plains_A1", "SW.Area.Plains.A1", ["SW.Mob.Zombie"], "SW_Area_Plains_A1_SW_TextEntry_Name")]);
  await putJson(T("DT_SpawnWaveDefinition"), [waveRow("PlainsA1_Arena", ["SW.Mob.Maw"])]);
  await putJson(T("DT_LootSourceDefinition_Mob"), [
    lootRow("Boss", "SW.Trait.Boss", [slot("Item", 1, 6, 0.5, true)]),
    lootRow("GlobalHostileMobLoot", "SW.Mob.Default.Hostile", [slot("Item", 0, 1, 0.0125, false)]),
  ]);
  await putJson(T("DT_LootSourceDefinition_Area"), [lootRow("PlainsA1", "SW.Area.Plains.A1", [slot("Item", 0, 0, 0, true, ["SW.Item.Sickles"])])]);
  await putJson(T("DT_ItemDefinitionMelee"), [itemRow("DT_ItemDefinitionMelee", "Sickles", "SW.Item.Sickles"), itemRow("DT_ItemDefinitionMelee", "TestBlade", "SW.Item.TestBlade")]);
  for (const name of ["DT_MobDefinition", "DT_MobType2Definition", "DT_MobSoulStatedDefinition", "DT_MobVariantDefinition", "DT_LootSourceDefinition", "DT_LootSourceDefinition_LootActor", "DT_LootSourceDefinition_Quest", "DT_ItemDefinitionRanged", "DT_ItemDefinitionArmor", "DT_ItemDefinitionArtifact", "DT_ItemDefinitionEnchantmentBook", "DT_ItemDefinitionTalisman"]) await putJson(T(name), []);
  const renders = path.join(sourceRoot, "Renders", "Mobs");
  await mkdir(renders, { recursive: true });
  await sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 160, b: 0, alpha: 1 } } }).png().toFile(path.join(renders, "Zombie.png"));
  await sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 90, g: 90, b: 90, alpha: 1 } } }).png().toFile(path.join(renders, "Evoker_FangTrap.png"));
});

const run = () => extractBestiary({ sourceRoot, outRoot, locales, entries: [makeEntry("Sickles", "melee")], map, overrideDir });

describe("extractBestiary", () => {
  it("builds mobs with stats, areas, drops and portraits, and the item sources", async () => {
    const result = await run();
    const zombie = result.mobs.mobs.find((mob) => mob.slug === "zombie");
    expect(zombie).toMatchObject({ kind: "regular", portrait: "mobs/zombie.webp", stats: [{ key: "health", value: 8 }] });
    expect(zombie?.areas.map((area) => area.areaId)).toEqual(["SW.Area.Plains.A1"]);
    expect(zombie?.drops[0]).toEqual({ slot: "item", guaranteed: 0, rolls: 1, chancePerRoll: 0.0125, pool: "none" });
    const maw = result.mobs.mobs.find((mob) => mob.slug === "maw");
    expect(maw?.drops[0]).toMatchObject({ guaranteed: 1, rolls: 6, chancePerRoll: 0.5 });
    expect(maw?.portrait).toBeUndefined();   // no Maw render in this source
    const sickles = result.sources.items["melee/sickles"];
    expect(sickles?.areas).toEqual(["area:SW.Area.Plains.A1"]);
    expect((await readdir(path.join(outRoot, "public", "mobs"))).sort()).toEqual(["large", "zombie.webp"]);
    expect(await readdir(path.join(outRoot, "public", "mobs", "large"))).toEqual(["zombie.webp"]);
  });

  it("reports renders with no mob page and mobs with no render, and publishes neither", async () => {
    const { issues } = await run();
    expect(issues).toContainEqual({ type: "mob-portrait-unjoined", detail: "Evoker_FangTrap.png" });
    expect(issues).toContainEqual({ type: "mob-no-portrait", detail: "bee" });
  });

  it("reports item rows that match no site entry", async () => {
    const { issues } = await run();
    expect(issues).toContainEqual({ type: "loot-item-unmatched", detail: "melee:TestBlade" });
    expect(issues.filter((item) => item.type === "loot-item-unmatched")).toHaveLength(1);
  });

  it("never reads the telemetry constants and never writes any of their values", async () => {
    const result = await run();
    expect(result.tablesRead.some((file) => /onlineconstants/i.test(file))).toBe(false);
    expect(result.tablesRead).toContain("DT_MobType1Definition.json");
    const text = JSON.stringify([result.mobs, result.sources, result.issues]);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("zzzzzzzzzzzzzzzzzzzzzzzz");
  });

  it("leaves both outputs empty and reports it when source-data has no mob or loot tables", async () => {
    const bare = await mkdtemp(path.join(tmpdir(), "mcd2-bare-"));
    const result = await extractBestiary({ sourceRoot: bare, outRoot, locales, entries: [], map, overrideDir });
    expect(result.mobs).toEqual({ mobs: [] });
    expect(result.sources).toEqual({ sources: {}, items: {}, bookDrops: [] });
    expect(result.issues.map((item) => item.type)).toEqual(expect.arrayContaining(["missing-mob-tables", "missing-loot-tables"]));
  });
});
