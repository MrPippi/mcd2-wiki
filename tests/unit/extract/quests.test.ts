import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { MapData } from "../../../scripts/extract/map-schema";
import type { ItemSourcesData, Mob, MobData } from "../../../scripts/extract/mob-schema";
import type { AreaRow } from "../../../scripts/extract/mob-tables";
import { QuestDataSchema } from "../../../scripts/extract/quest-schema";
import type { QuestTables } from "../../../scripts/extract/quest-tables";
import { QUEST_COMPLETED, QUEST_DESCRIPTIONS, QUEST_LABELS } from "../../../scripts/extract/quest-texts";
import { buildQuestData, extractQuests, type QuestsInput } from "../../../scripts/extract/quests";
import { localizedFrom } from "../../../src/lib/lang";
import { makeLocales, ns } from "../../helpers/locales";
import { areaRow } from "../../helpers/mob-tables";
import { group, libraryRow, lootEntry, lootRow, rawQuest, SIZE_ROWS, task } from "../../helpers/quest-tables";

const FOREST = "SW.Area.Forest.A1";
const PLAINS = "SW.Area.Plains.A1";

const QUESTS = [
  rawQuest({
    id: "CA01",
    type: "CoreQuest",
    prerequisites: ["CA00"],
    size: "SW.QuestSize.Medium",
    area: PLAINS,
    first: [lootEntry("SW.Quest.Loot.Melee.Axe", "SW.RarityChance.Quest.Rare")],
    every: [lootEntry("SW.Quest.Loot.AreaDropModifier", PLAINS)],
    goals: group("CA01_Sequence01", [
      task("CA01_E01"),
      task("CA01_K01", { kill_count: 5, kill_target_types: ["SW.Mob.Pillager", "SW.Mob.Ghost"] }),
      task("CA01_K02", { kill_count: 5, kill_target_types: ["SW.Mob.Pillager"] }),
      task("CA01_AS01", { arena_tag: "SW.ArenaSetup.Boss" }),
    ]),
  }),
  rawQuest({ id: "CA00", type: "CoreQuest", area: PLAINS, state: "Active" }),
  rawQuest({ id: "S_FOREST", prerequisites: ["CA01"], area: FOREST }),
  rawQuest({ id: "S_PLAINS", prerequisites: ["CA00"], area: PLAINS, every: [lootEntry("SW.Quest.Loot.Armour.PhantomSet")] }),
  rawQuest({ id: "S_PLAINS_2", prerequisites: ["S_PLAINS", "GHOST"], area: PLAINS }),
  rawQuest({ id: "CT_S01_A", prerequisites: ["CA00"], area: "SW.Area", replayable: true }),
  rawQuest({ id: "CA01_BR", prerequisites: ["CA01"], area: PLAINS, first: [lootEntry("SW.Quest.Loot.Talisman.Wolf")] }),
  rawQuest({ id: "CA04_BR", prerequisites: ["CA01"], first: [lootEntry("SW.Quest.Loot.Talisman.Wolf")] }),
  rawQuest({ id: "TOa1_S01_A", state: "Unavailable", prerequisites: ["CA01"] }),
  rawQuest({ id: "DEV_S01", prerequisites: ["CA01"] }),
];

const titles = Object.fromEntries(
  ["CA00", "CA01", "S_FOREST", "S_PLAINS", "S_PLAINS_2", "CT_S01_A", "CA01_BR", "DEV_S01"].map((id) => [id, { en: `Title ${id}`, zh: `標題 ${id}` }]),
);
const LOCALES = makeLocales({
  [QUEST_LABELS]: {
    ...titles,
    TOa1_S01_A: { en: "ERROR" },
    CA01_E01: { en: "Find the rift" },
    CA01_K01: { en: "Defeat the illagers" },
    CA01_K02: { en: "Defeat the illagers" },
  },
  [QUEST_DESCRIPTIONS]: { CA01: { en: "The <emphasis>rift</>" }, DEV_S01: { en: "ERROR" } },
  [QUEST_COMPLETED]: { CA01: { en: "Done" } },
  [ns("DT_AreaDefinition")]: { Forest: { en: "Howling Woods", zh: "嚎叫森林" }, Plains: { en: "Honeycomb Fields" } },
});

const mob = (slug: string, kind: Mob["kind"], name: string): Mob => ({
  slug, id: slug, kind, world: null, name: localizedFrom(() => name), untranslated: [], stats: [], variants: [], areas: [], drops: [],
});
const MOBS: MobData = { mobs: [mob("pillager", "regular", "Pillager"), mob("maw", "boss", "Maw")] };
const noSources = { areas: [], chests: [], merchants: [], bookPools: [] };
const SOURCES: ItemSourcesData = {
  sources: {},
  items: {
    "melee/axe": { ...noSources, quests: [{ id: "quest:QuestMeleeAxe" }] },
    "armor/phantom-boots": { ...noSources, quests: [{ id: "quest:QuestArmourPhantomSet", picks: { count: 1, of: 1 } }] },
    "talisman/wolf": { ...noSources, quests: [{ id: "quest:QuestTalismanWolf" }] },
  },
};
const TABLES: QuestTables = {
  quests: QUESTS.map((quest) => ({ library: "Test", quest })),
  loot: [
    ...SIZE_ROWS,
    lootRow("QuestMeleeAxe", "SW.Quest.Loot.Melee.Axe", [{ slot: "SpecialGear", guaranteed: 1, items: ["SW.Item.Axe"] }]),
    lootRow("QuestArmourPhantomSet", "SW.Quest.Loot.Armour.PhantomSet", [{ slot: "SpecialGear", guaranteed: 1, items: ["SW.Item.PhantomBoots"] }]),
    lootRow("QuestTalismanWolf", "SW.Quest.Loot.Talisman.Wolf", [{ slot: "Talismans", guaranteed: 1, items: ["SW.Item.Talisman.Wolf"] }]),
  ],
  arenas: [{ TypeTag: { TagName: "SW.ArenaSetup.Boss" }, ArenaFightsDefinition: { SpawnWaveDefinition: { TagName: "SW.ArenaWave.Boss" } } }],
  waves: [{ TypeTag: { TagName: "SW.ArenaWave.Boss" }, SpawnWaveDefinition: { Waves: [{ Waves: [{ MobType: { TagName: "SW.Mob.Maw" } }] }] } }],
};
const AREAS = [areaRow("Forest", FOREST, [], "Forest"), areaRow("Plains", PLAINS, [], "Plains"), areaRow("Default", "SW.Area", [], "Plains")] as unknown as AreaRow[];
const MAP = { worlds: [{ key: "overworld", markers: [{ kind: "area", id: "area:sw.area.forest.a1", px: 10, py: 20 }] }], legend: {} } as unknown as MapData;

const input = (sourceRoot = ""): QuestsInput => ({
  sourceRoot,
  locales: LOCALES,
  sources: SOURCES,
  links: { tagIndex: new Map([["sw.mob.pillager", "pillager"], ["sw.mob.maw", "maw"]]), areas: AREAS },
  mobs: MOBS,
  map: MAP,
});

const built = buildQuestData(TABLES, input());
const quest = (slug: string) => built.data.quests.find((one) => one.slug === slug);

describe("buildQuestData", () => {
  it("validates against the output schema", () => {
    expect(QuestDataSchema.safeParse(built.data).success).toBe(true);
  });

  it("leaves out quests without a title, with an ERROR title or description, and reports each", () => {
    expect(built.data.quests.map((one) => one.id)).not.toEqual(expect.arrayContaining(["CA04_BR"]));
    expect(built.issues.filter((one) => one.type === "quest-skipped")).toEqual([
      { type: "quest-skipped", detail: "CA04_BR: no title" },
      { type: "quest-skipped", detail: "TOa1_S01_A: unavailable, no title" },
      { type: "quest-skipped", detail: "DEV_S01: description is ERROR" },
    ]);
  });

  it("lists the core chain, side quests by region in story order, Echo Golem quests, then replays", () => {
    expect(built.data.quests.map((one) => one.slug)).toEqual(["ca00", "ca01", "s-plains", "s-plains-2", "s-forest", "ct-s01-a", "ca01-br"]);
    expect(built.data.quests.map((one) => one.section)).toEqual(["core", "core", "side", "side", "side", "echoGolem", "bossReplay"]);
  });

  it("links prerequisites and unlocks by slug, dropping left-out and unknown quests", () => {
    expect(quest("ca01")?.prerequisites).toEqual(["ca00"]);
    expect(quest("ca01")?.unlocks).toEqual(["s-forest", "ca01-br"]);
    expect(quest("ca00")?.unlocks).toEqual(["ca01", "s-plains", "ct-s01-a"]);
    expect(quest("s-plains-2")?.prerequisites).toEqual(["s-plains"]);
    expect(built.issues).toContainEqual({ type: "quest-prerequisite-unknown", detail: "S_PLAINS_2 → GHOST" });
  });

  it("flattens labelled objectives, deduplicated, with counts", () => {
    expect(quest("ca01")?.objectives.map((one) => [one.text.en, one.count])).toEqual([["Find the rift", 1], ["Defeat the illagers", 5]]);
  });

  it("gives the region with its map spot, and none for the whole-world area", () => {
    expect(quest("s-forest")?.region).toEqual({ areaId: FOREST, name: expect.objectContaining({ en: "Howling Woods", zh: "嚎叫森林" }), map: { world: "overworld", px: 10, py: 20 } });
    expect(quest("ca01")?.region?.map).toBeUndefined();
    expect(quest("ct-s01-a")?.region).toBeNull();
  });

  it("maps first-completion and repeat rewards and the emerald bundle of the size", () => {
    const rewards = quest("ca01")?.rewards;
    expect(rewards?.first).toEqual([{ kind: "items", source: "quest:QuestMeleeAxe", items: ["melee/axe"], rarity: "rare" }]);
    expect(rewards?.every).toEqual([{ kind: "areaDrop", area: { name: expect.objectContaining({ en: "Honeycomb Fields" }) }, count: 1 }]);
    expect(rewards?.emeralds).toEqual({ guaranteed: 8, rolls: 8, chancePerRoll: 0.25 });
  });

  it("names related mobs from kill targets and arena waves, bosses first, and reports tags with no page", () => {
    expect(quest("ca01")?.mobs).toEqual(["maw", "pillager"]);
    expect(built.issues).toContainEqual({ type: "quest-mob-unlinked", detail: "CA01: SW.Mob.Ghost" });
  });

  it("keeps the texts and reports a missing one", () => {
    expect(quest("ca01")?.description?.html.en).toBe('The <em class="emphasis">rift</em>');
    expect(quest("ca01")?.title.text.zh).toBe("標題 CA01");
    expect(quest("ca00")?.description).toBeNull();
    expect(built.issues).toContainEqual({ type: "quest-text-missing", detail: "CA00: QuestDescriptions" });
  });

  it("links a reward row to its quests only when every quest that gives it is published", () => {
    expect(built.data.rewardSources).toEqual({ "quest:QuestArmourPhantomSet": ["s-plains"], "quest:QuestMeleeAxe": ["ca01"] });
  });
});

describe("extractQuests", () => {
  it("returns empty data and the missing-table issue without source tables", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "mcd2-no-quests-"));
    const result = await extractQuests(input(root));
    expect(result.data).toEqual({ quests: [], rewardSources: {} });
    expect(result.issues).toEqual([{ type: "missing-quest-tables", detail: "DT_QuestLibraries.json" }]);
    expect(result.tablesRead).toEqual([]);
  });

  it("reads the tables from source-data and builds the same data", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "mcd2-quests-full-"));
    const dir = path.join(root, "DataTables", "UFS");
    await mkdir(dir, { recursive: true });
    const tables = {
      DT_QuestLibraries: [libraryRow("Test", QUESTS)],
      DT_LootSourceDefinition_Quest: TABLES.loot,
      DT_ArenaFightDefinition: TABLES.arenas,
      DT_SpawnWaveDefinition: TABLES.waves,
    };
    for (const [name, rows] of Object.entries(tables)) await writeFile(path.join(dir, `${name}.json`), JSON.stringify(rows), "utf8");
    const result = await extractQuests(input(root));
    expect(result.data).toEqual(built.data);
    expect(result.tablesRead).toHaveLength(4);
  });
});

describe("quest gaps", () => {
  const odd = rawQuest({ id: "CA00", type: "CoreQuest", size: "SW.QuestSize.Huge", area: "SW.Area.Nowhere" });
  const result = buildQuestData({ ...TABLES, quests: [{ library: "Test", quest: odd }] }, input());

  it("shows an unknown size as small and reports it", () => {
    expect(result.data.quests[0]?.size).toBe("small");
    expect(result.data.quests[0]?.rewards.emeralds).toBeNull();
    expect(result.issues).toContainEqual({ type: "quest-text-missing", detail: "CA00: size SW.QuestSize.Huge (shown as small)" });
  });

  it("drops a region the game gives no name and reports it", () => {
    expect(result.data.quests[0]?.region).toBeNull();
    expect(result.issues).toContainEqual({ type: "quest-area-unnamed", detail: "CA00: SW.Area.Nowhere" });
  });
});
