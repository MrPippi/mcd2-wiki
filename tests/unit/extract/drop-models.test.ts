import { describe, expect, it } from "vitest";
import { buildDropModels, NO_DROPS, parseDropData, type DropInput } from "../../../scripts/extract/drop-models";
import type { DropTables } from "../../../scripts/extract/drop-tables";
import { ItemSourcesSchema, MobDataSchema } from "../../../scripts/extract/mob-schema";
import { itemRows } from "../../../src/lib/drop-odds";
import { makeEntry } from "../../helpers/entries";
import { dropLoot, gear } from "../../helpers/drop-tables";
import { loc } from "../../helpers/localized";
import { lootRow, slot } from "../../helpers/mob-tables";
import { lootEntry, rawQuest } from "../../helpers/quest-tables";

const SPAWN = "SW.Property.Spawnable";
const AREA = "SW.Area.Plains.A1";
const rarityEntry = (rarity: string, weight: number, operation: "Set" | "Multiply") => ({ TypeTag: { TagName: `SW.Rarity.${rarity}` }, Weight: weight, Operation: operation });

const loot = dropLoot({
  melee: [
    gear("melee", "Sword", "SW.Item.Sword", { traits: [SPAWN, "SW.Item.Property.MeleeWeapon"], sub: "SW.Item.Sword_Unique1" }),
    gear("melee", "Sword_Unique1", "SW.Item.Sword_Unique1", { traits: [SPAWN, "SW.Item.Property.MeleeWeapon"], rarities: ["SW.Rarity.Unique"] }),
    gear("melee", "Mace", "SW.Item.Mace", { traits: [SPAWN, "SW.Item.Property.MeleeWeapon"] }),
  ],
  enchantmentBook: [
    gear("enchantmentBook", "Arcane", "SW.Item.EnchantmentBook.Arcane", { traits: [SPAWN, "SW.Item.Property.EnchantmentBook"] }),
    gear("enchantmentBook", "Dynamo", "SW.Item.EnchantmentBook.Dynamo", { traits: [SPAWN, "SW.Item.Property.EnchantmentBook"] }),
  ],
  talisman: [gear("talisman", "Wolf", "SW.Item.Talisman.Wolf", { traits: [SPAWN, "SW.Item.Property.Talisman"] })],
  generic: [lootRow("BooksCommon", "SW.LootSource.Books.Common", [slot("EnchantedBook", 0, 0, 0, false, [["SW.Item.EnchantmentBook.Arcane", 1000, "Set"], ["SW.Item.EnchantmentBook.Dynamo", 1000, "Set"], "SW.Item.Currency.SpringStone"])])],
  area: [
    lootRow("Global", "SW.Area", [slot("EnchantedBook", 0, 0, 0, true)], ["SW.LootSource.Books.Common"]),
    lootRow("PlainsA1", AREA, [slot("Item", 0, 0, 0, true, ["SW.Item.Sword", "SW.Item.Mace"])]),
  ],
  lootActor: [
    lootRow("FancyChest", "SW.LootActor.FancyChest", [slot("Item", 1, 0, 0, true)]),
    lootRow("FancyChest_Procedural", "SW.LootActor.FancyChest.Procedural", [slot("EnchantedBook", 1, 1, 0.5, true)], ["SW.LootActor.FancyChest"]),
    lootRow("TalismansChest_Wolf", "SW.LootActor.TalismansChest.Wolf", [slot("Talismans", 1, 0, 0, true, ["SW.Item.Talisman.Wolf"])], ["SW.LootActor.FancyChest"]),
    lootRow("StorminatorChest", "SW.LootActor.StorminatorChest", [], ["SW.LootActor.FancyChest"]),
  ],
  quest: [
    lootRow("QuestWolf", "SW.Quest.Loot.Wolf", [slot("SpecialGear", 1, 0, 1, false, ["SW.Item.Talisman.Wolf"])]),
    lootRow("AreaDrop", "SW.Quest.Loot.AreaDropModifier", [slot("Item", 1, 0, 0, false)]),
  ],
});
const tables: DropTables = {
  slotRules: [
    { TypeTag: { TagName: "SW.LootSlot.Item" }, SlotData: { RecentDropsToTrack: 3, LootModificationFunctions: [{ TagName: "SW.LootModificationFunction.PreventRepeatingDrops" }] } },
    { TypeTag: { TagName: "SW.LootSlot.EnchantedBook" }, SlotData: { RecentDropsToTrack: 4, LootModificationFunctions: [{ TagName: "SW.LootModificationFunction.PreventRepeatingDrops" }, { TagName: "SW.LootModificationFunction.PreventDuplicateOneOfAKindDrops" }] } },
  ],
  rarityChance: [
    { TypeTag: { TagName: "SW.RarityChanceDefinition.Default" }, TagList: { Tags: [rarityEntry("Common", 50, "Set"), rarityEntry("Rare", 25, "Set"), rarityEntry("Special", 20, "Set"), rarityEntry("Unique", 5, "Set")] } },
    { TypeTag: { TagName: "SW.Player" }, Traits: { GameplayTags: [{ TagName: "SW.RarityChanceDefinition.Default" }] }, TagList: {} },
    { TypeTag: { TagName: "SW.LootActor.FancyChest" }, TagList: { Tags: [rarityEntry("Common", 0, "Multiply")] } },
    { TypeTag: { TagName: "SW.Difficulty.Low" }, TagList: { Tags: [rarityEntry("Special", 0, "Multiply"), rarityEntry("Unique", 0, "Multiply")] } },
  ],
  hierarchy: [],
  areas: [],
  difficulties: [{ Name: "Normal", TypeTag: { TagName: "SW.Difficulty.Normal" } }, { Name: "Low", TypeTag: { TagName: "SW.Difficulty.Low" } }],
};
const named = (kind: string) => ({ kind, name: loc({ en: kind }), untranslated: [] });
const sources = ItemSourcesSchema.parse({
  sources: {
    [`area:${AREA}`]: named("area"),
    "chest:FancyChest": named("chest"),
    "chest:TalismansChest_Wolf": named("chest"),
    "bookPool:BooksCommon": named("bookPool"),
  },
  items: { "melee/sword": { areas: [`area:${AREA}`], chests: [{ id: "chest:FancyChest", pool: "area" }, { id: "chest:TalismansChest_Wolf", pool: "fixed" }], quests: [], merchants: [], bookPools: [] } },
  bookDrops: [],
});
const mobs = MobDataSchema.parse({
  mobs: [
    { slug: "big-boss", id: "BigBoss", kind: "boss", world: null, name: loc({ en: "Boss" }), untranslated: [], stats: [], variants: [], areas: [{ areaId: AREA, name: loc({ en: "Plains" }) }], drops: [{ slot: "item", guaranteed: 1, rolls: 0, chancePerRoll: 0, pool: "area" }, { slot: "specialGear", guaranteed: 1, rolls: 0, chancePerRoll: 1, pool: "own" }] },
    { slug: "zombie", id: "Zombie", kind: "regular", world: null, name: loc({ en: "Zombie" }), untranslated: [], stats: [], variants: [], areas: [{ areaId: AREA, name: loc({ en: "Plains" }) }], drops: [{ slot: "item", guaranteed: 0, rolls: 1, chancePerRoll: 0.0125, pool: "area" }] },
  ],
});
const input: DropInput = {
  loot,
  tables,
  entries: [
    makeEntry("Sword", "melee"), makeEntry("Sword_Unique1", "melee"), makeEntry("Mace", "melee"),
    makeEntry("Arcane", "enchantment-book"), makeEntry("Dynamo", "enchantment-book"), makeEntry("Wolf", "talisman"),
  ],
  threat: [{ level: 1, rarity: { common: 1, rare: 1, special: 1, unique: 1 } }, { level: 20, rarity: { common: 0.5, rare: 0.5, special: 1, unique: 1 } }],
  sources,
  quests: [
    { library: "Lib", quest: rawQuest({ id: "Q1", area: AREA, first: [lootEntry("SW.Quest.Loot.Wolf")], every: [lootEntry("SW.Quest.Loot.AreaDropModifier", AREA)] }) },
    { library: "Lib", quest: rawQuest({ id: "Hidden", area: AREA, every: [lootEntry("SW.Quest.Loot.Wolf")] }) },
  ],
  publishedQuests: new Set(["Q1"]),
  mobs,
  mobTags: new Map(),
};
const built = buildDropModels(input);
const data = built.data;
const UNIQUE_KEY = `melee/${makeEntry("Sword_Unique1", "melee").slug}`;
const AT_20 = { level: 20, difficulty: "normal", rarity: "any" } as const;
const odds = (key: string, selection = AT_20) => Object.fromEntries(itemRows(data, key, selection).map((row) => [`${row.source}@${row.area}`, row.probability]));

describe("buildDropModels", () => {
  it("passes its own schema and keeps the threat levels with their rarity factors", () => {
    expect(() => parseDropData(data)).not.toThrow();
    expect(data.levels).toEqual([1, 20]);
    expect(data.rarityFactors[1]).toEqual([0.5, 0.5, 1, 1]);
  });

  it("covers listed chests, their procedural versions, quests and bosses, and nothing else", () => {
    expect(data.sources.map((source) => source.id).sort()).toEqual(
      ["chest:FancyChest", "chest:FancyChest_Procedural", "chest:TalismansChest_Wolf", "mob:BigBoss", "quest:Q1:0", "quest:Q1:1"].sort(),
    );
  });

  it("pairs a chest that draws from its area with the areas, and a fixed chest with none", () => {
    const find = (id: string) => data.sources.find((source) => source.id === id)?.contexts.map(([area]) => area);
    expect(find("chest:FancyChest")).toEqual([`area:${AREA}`]);
    expect(find("chest:TalismansChest_Wolf")).toEqual([""]);
  });

  it("marks the quest batch given on the first completion only", () => {
    expect(data.sources.find((source) => source.id === "quest:Q1:0")?.first).toBe(true);
    expect(data.sources.find((source) => source.id === "quest:Q1:1")?.first).toBeUndefined();
  });

  it("gives the chance of an item from a chest: its share of the pool, then its rarity (Common is 0 in a fancy chest)", () => {
    // Pool Sword 1, Mace 1; Fancy chest at threat 20: Rare 12.5, Special 20, Unique 5 -> Unique is 5 / 37.5.
    const fancy = odds("melee/sword")[`chest:FancyChest@area:${AREA}`];
    expect(fancy).toBeCloseTo(0.5 * (1 - 5 / 37.5));
    expect(odds(UNIQUE_KEY)[`chest:FancyChest@area:${AREA}`]).toBeCloseTo(0.5 * (5 / 37.5));
    expect(odds("melee/mace")[`chest:FancyChest@area:${AREA}`]).toBeCloseTo(0.5);
  });

  it("applies the difficulty row, so Low removes the Unique variants", () => {
    expect(odds(UNIQUE_KEY, { ...AT_20, difficulty: "low" })).toEqual({});
  });

  it("gives a book from a procedural chest: the area's Common books, rolls first, no repeats, a currency taking weight", () => {
    // Pool Arcane 1000, Dynamo 1000, SpringStone 1; one guaranteed draw and one roll at 50%.
    const arcane = odds("enchantment-book/arcane")[`chest:FancyChest_Procedural@area:${AREA}`];
    const first = 1000 / 2001;
    const two = first + (1000 / 2001) * (1000 / 1001) + (1 / 2001) * (1000 / 2000);
    expect(arcane).toBeCloseTo(0.5 * first + 0.5 * two, 10);
  });

  it("gives a fixed talisman chest's talisman for sure, and a quest its reward", () => {
    expect(odds("talisman/wolf")["chest:TalismansChest_Wolf@"]).toBeCloseTo(1);
    expect(odds("talisman/wolf")["quest:Q1:0@"]).toBeCloseTo(1);
  });

  it("covers the area drop of a quest batch with the quest's reward area", () => {
    expect(odds("melee/mace")["quest:Q1:1@"]).toBeCloseTo(0.5);
  });

  it("gives a boss the counts and area pool the bestiary shows", () => {
    expect(odds("melee/mace")[`mob:BigBoss@area:${AREA}`]).toBeCloseTo(0.5);
  });

  it("reports what it leaves out", () => {
    const details = built.issues.map((one) => one.detail);
    expect(details).toContain("1 unpublished quests have no drop odds");
    expect(details).toContain("BigBoss: specialGear draws from its own list, not covered");
    expect(built.issues.every((one) => one.type === "drop-ignored")).toBe(true);
  });

  it("keeps the rules of the slots in use", () => {
    expect(data.slots).toEqual({ item: { history: 3, oneOfAKind: false }, enchantedbook: { history: 4, oneOfAKind: true } });
  });

  it("names the difficulties' rarity rows", () => {
    expect(data.difficulties).toEqual({ normal: [], low: [[2, "m", 0], [3, "m", 0]] });
  });

  it("is empty, with an issue, when no threat level has rarity factors", () => {
    const empty = buildDropModels({ ...input, threat: [{ level: 1 }] });
    expect(empty.data).toEqual(NO_DROPS);
    expect(empty.issues.map((one) => one.type)).toEqual(["guides-value-missing"]);
  });
});
