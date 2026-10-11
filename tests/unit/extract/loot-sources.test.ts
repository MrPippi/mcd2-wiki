import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildItemIndex } from "../../../scripts/extract/loot-items";
import { buildItemSources } from "../../../scripts/extract/loot-sources";
import { loadLootTables } from "../../../scripts/extract/loot-tables";
import { buildAreaNamer } from "../../../scripts/extract/mob-areas";
import { loadMobTables } from "../../../scripts/extract/mob-tables";
import { loadLocales } from "../../../scripts/extract/parse-locale";
import { EntrySchema } from "../../../scripts/extract/schemas";
import { makeEntry } from "../../helpers/entries";
import { makeLocales, ns } from "../../helpers/locales";
import { loc } from "../../helpers/localized";
import { itemRow, lootRow, lootTables, slot } from "../../helpers/mob-tables";

const MELEE = "DT_ItemDefinitionMelee";
const ARMOR = "DT_ItemDefinitionArmor";
const BOOK = "DT_ItemDefinitionEnchantmentBook";
const ARTIFACT = "DT_ItemDefinitionArtifact";
const PIECES = ["Helmet", "Chest", "Leggings", "Boots"];
const BOOKS = ["Arcane", "Piercing", "Radiance", "Ricochet"];

const armor = (set: string, pieces = PIECES) => pieces.map((piece) => itemRow(ARMOR, `${set}${piece}`, `SW.Item.${set}${piece}`, [`SW.Item.ArmorSet.${set}`]));
const books = BOOKS.map((name) => itemRow(BOOK, name, `SW.Item.EnchantmentBook.${name}`, ["SW.Item.Property.EnchantmentBook"], `SW_Item_EnchantmentBook_${name}_SW_TextEntry_Name`));

const base = {
  melee: [
    itemRow(MELEE, "Sickles", "SW.Item.Sickles", ["SW.Item.Property.MeleeWeapon"]),
    itemRow(MELEE, "Sword", "SW.Item.Sword", ["SW.Item.Property.MeleeWeapon"]),
    itemRow(MELEE, "Sword_Unique1", "SW.Item.Sword_Unique1", ["SW.Item.Property.MeleeWeapon", "SW.Item.Property.Unique"]),
  ],
  armor: [...armor("Mushroom"), ...armor("Mystic", ["Helmet", "Chest"])],
  artifact: [itemRow(ARTIFACT, "Artifact_FireworkQuiver", "SW.Item.Artifact.FireworkQuiver", [], "SW_Item_Artifact_FireworkQuiver_SW_TextEntry_Name")],
  enchantmentBook: books,
  area: [
    lootRow("PlainsA1", "SW.Area.Plains.A1", [slot("Item", 0, 0, 0, true, ["SW.Item.Sickles", "SW.Item.ArmorSet.Mystic"])]),
    lootRow("CampA1", "SW.Area.Camp.A1", [slot("Item", 0, 0, 0, true, [["SW.Item.Sword", 0, "Multiply"]])]),
    lootRow("GlobalAreaLoot", "SW.Area", [slot("Item", 0, 0, 0, true, ["SW.Item.Sword"])]),
  ],
  lootActor: [
    lootRow("FancyChest", "SW.LootActor.FancyChest", [slot("Item", 1, 0, 0, true)]),
    lootRow("CampWoodenChest", "SW.LootActor.CampWoodenChest", [slot("Item", 1, 0, 0, false, ["SW.Item.Artifact.FireworkQuiver"])]),
  ],
  quest: [
    lootRow("QuestArmourMushroomSet", "SW.Quest.Loot.Armour.MushroomSet", [slot("SpecialGear", 2, 0, 1, false, PIECES.map((piece) => `SW.Item.Mushroom${piece}`))]),
    lootRow("QuestMeleeSword", "SW.Quest.Loot.Melee.Sword", [slot("SpecialGear", 1, 0, 1, false, ["SW.Item.Sword"])]),
    lootRow("QuestRandomSickles", "SW.Quest.Loot.Melee.Sickles", [slot("SpecialGear", 0, 1, 0.5, false, ["SW.Item.Sickles"])]),
    lootRow("EnchantsmithBookReward", "SW.Quest.Loot.Book", [slot("EnchantedBook", 3, 0, 1, false, ["SW.Item.EnchantmentBook.Piercing", "SW.Item.EnchantmentBook.Radiance", "SW.Item.EnchantmentBook.Ricochet"])]),
    lootRow("QuestMeleeDaggerUnique_)1", "SW.Quest.Loot.Melee.Dagger", [slot("SpecialGear", 1, 0, 1, false, [])]),
  ],
  generic: [
    lootRow("VillageMerchant", "SW.NPC.VillageMerchant", [slot("Item", 1, 0, 0, false, [["SW.Item.Property.MeleeWeapon", 2, "Set"], ["SW.Item.Property.Unique", 0, "Multiply"]])]),
    lootRow("EnchantmentBooksCommon", "SW.LootSource.EnchantmentBooks.Common", [slot("EnchantedBook", 0, 0, 0, false, ["SW.Item.EnchantmentBook.Arcane", "SW.Item.EnchantmentBook.Ricochet"])]),
    // Real shape: the all-books pool is the book trait tag, with an exclusion row named in its traits.
    lootRow("AllEnchantmentBooks", "SW.LootSource.EnchantmentBooksAll", [slot("EnchantedBook", 0, 0, 0, false, [["SW.Item.Property.EnchantmentBook", 100000, "Set"], "SW.Item.Currency.SpringStone"])], ["SW.LootSource.EnchantmentBooksExcludeQuestBooks"]),
    lootRow("EnchantmentBooksExcludeQuestBooks", "SW.LootSource.EnchantmentBooksExcludeQuestBooks", [slot("", 0, 0, 0, false, [["SW.Item.EnchantmentBook.Piercing", 0, "Multiply"], ["SW.Item.EnchantmentBook.Radiance", 0, "Multiply"]])]),
  ],
};

const entries = [
  makeEntry("Sickles", "melee"), makeEntry("Sword", "melee"), makeEntry("Sword_Unique1", "melee"),
  ...[...PIECES.map((p) => `Mushroom${p}`), "MysticHelmet", "MysticChest"].map((id) => makeEntry(id, "armor")),
  makeEntry("Artifact_FireworkQuiver", "artifact"),
  ...BOOKS.map((name) => makeEntry(`EnchantmentBook_${name}`, "enchantment-book")),
];
const locales = makeLocales({});
const namer = (tag: string) => (tag === "SW.Area.Plains.A1" ? loc({ en: "Creeper Woods", zh: "苦力怕森林" }) : undefined);

function run(overrides: Partial<typeof base> = {}, nameKeys = {}, localeFiles = locales) {
  const tables = lootTables({ ...base, ...overrides });
  return buildItemSources({ tables, index: buildItemIndex(tables, entries), namer, locales: localeFiles, nameKeys });
}

describe("buildItemSources", () => {
  it("lists the area whose drop pool contains a weapon (PlainsA1 contains Sickles)", () => {
    const sickles = run().data["melee/sickles"];
    expect(sickles?.areas).toEqual([{ areaId: "SW.Area.Plains.A1", name: expect.objectContaining({ en: "Creeper Woods", zh: "苦力怕森林" }) }]);
  });

  it("expands an armor set tag so each piece has the area", () => {
    const { data } = run();
    expect(data["armor/mystic-helmet"]?.areas.map((area) => area.areaId)).toEqual(["SW.Area.Plains.A1"]);
    expect(data["armor/mystic-chest"]?.areas.map((area) => area.areaId)).toEqual(["SW.Area.Plains.A1"]);
    expect(data["armor/mushroom-helmet"]?.areas).toEqual([]);
  });

  it("treats Multiply 0 as an exclusion: CampA1 and the global row add nothing to Sword's areas", () => {
    expect(run().data["melee/sword"]?.areas ?? []).toEqual([]);
  });

  it("names an area without a game name in English words, marks it untranslated and reports it", () => {
    const area = [...base.area, lootRow("ForestA1", "SW.Area.Forest.A1.Inner", [slot("Item", 0, 0, 0, true, ["SW.Item.Sickles"])])];
    const { data, issues } = run({ area });
    const forest = data["melee/sickles"]?.areas.find((item) => item.areaId === "SW.Area.Forest.A1");
    expect(forest?.name.en).toBe("Forest A1");
    expect(forest?.name.ja).toBe("Forest A1");
    expect(data["melee/sickles"]?.untranslated).toContain("zh");
    expect(issues).toContainEqual({ type: "source-name-fallback", detail: "SW.Area.Forest.A1" });
  });

  it("marks quest rewards as guaranteed and says 2 of 4 for the mushroom set", () => {
    const { data } = run();
    expect(data["armor/mushroom-chest"]?.quests).toEqual([
      { id: "QuestArmourMushroomSet", name: expect.objectContaining({ en: "Quest reward: Armour Mushroom Set" }), guaranteed: true, picks: { count: 2, of: 4 } },
    ]);
    expect(data["melee/sword"]?.quests).toEqual([{ id: "QuestMeleeSword", name: expect.objectContaining({ en: "Quest reward: Melee Sword" }), guaranteed: true }]);
  });

  it("ignores a quest row that is not guaranteed, and reports it", () => {
    const { data, issues } = run();
    expect(data["melee/sickles"]?.quests ?? []).toEqual([]);
    expect(issues).toContainEqual({ type: "loot-quest-not-guaranteed", detail: "QuestRandomSickles" });
  });

  it("counts a quest with no fixed drop but a certain roll as guaranteed", () => {
    const quest = [lootRow("QuestCertainSickles", "SW.Quest.Loot.Melee.Sickles", [slot("SpecialGear", 0, 1, 1, false, ["SW.Item.Sickles"])])];
    expect(run({ quest }).data["melee/sickles"]?.quests.map((item) => item.id)).toEqual(["QuestCertainSickles"]);
  });

  it("separates chests that draw from the area pool from chests with fixed contents", () => {
    const { data } = run();
    expect(data["melee/sickles"]?.chests).toEqual([{ id: "FancyChest", name: expect.objectContaining({ en: "Chest: Fancy Chest" }), pool: "area" }]);
    expect(data["artifact/firework-quiver"]?.chests).toEqual([{ id: "CampWoodenChest", name: expect.objectContaining({ en: "Chest: Camp Wooden Chest" }), pool: "fixed" }]);
    expect(data["melee/sword"]?.chests ?? []).toEqual([]);   // Sword is in no area pool, so the fancy chest cannot give it
  });

  it("does not spread a chest's category pool over every item, and reports it", () => {
    const lootActor = [...base.lootActor, lootRow("KeyChest", "SW.LootActor.KeyChest", [slot("Item", 1, 0, 0, false, ["SW.Item.Property.MeleeWeapon"])])];
    const { data, issues } = run({ lootActor });
    expect(data["melee/sword"]?.chests ?? []).toEqual([]);
    expect(issues).toContainEqual({ type: "loot-chest-by-category", detail: "KeyChest: SW.Item.Property.MeleeWeapon" });
  });

  it("reports a chest whose only slot has no name instead of guessing what it gives", () => {
    const lootActor = [lootRow("CampWoodenChest", "SW.LootActor.CampWoodenChest", [slot("", 1, 0, 1, true, ["SW.Item.Artifact.FireworkQuiver"])])];
    const { data, issues } = run({ lootActor });
    expect(data["artifact/firework-quiver"]).toBeUndefined();
    expect(issues).toContainEqual({ type: "loot-slot-unnamed", detail: "CampWoodenChest" });
  });

  it("gives merchants by category only, keeps the category tag, and not for unique items", () => {
    const { data } = run();
    expect(data["melee/sword"]?.merchants).toEqual([
      { id: "VillageMerchant", name: expect.objectContaining({ en: "Merchant: Village Merchant" }), byCategory: true, category: "SW.Item.Property.MeleeWeapon" },
    ]);
    expect(data["melee/sword-unique1"]?.merchants ?? []).toEqual([]);
    expect(data["armor/mushroom-chest"]?.merchants ?? []).toEqual([]);
  });

  it("does not make a merchant source from an exact item tag", () => {
    const generic = [lootRow("VillageMerchant", "SW.NPC.VillageMerchant", [slot("Item", 1, 0, 0, false, ["SW.Item.Sickles"])])];
    expect(run({ generic }).data["melee/sickles"]?.merchants).toEqual([]);
  });

  it("uses the game's merchant title when the key is known", () => {
    const official = makeLocales({ [ns("VendorLabels")]: { vendor_village_merchant_title: { en: "Town Merchant", zh: "城鎮商人" } } });
    const keys = { VillageMerchant: { namespace: ns("VendorLabels"), key: "vendor_village_merchant_title" } };
    const merchant = run({}, keys, official).data["melee/sword"]?.merchants[0];
    expect(merchant?.name.zh).toBe("城鎮商人");
  });

  it("puts books in their pools, drops the excluded quest books from the all-books pool, and still lists them as quest rewards", () => {
    const { data } = run();
    expect(data["enchantment-book/arcane"]?.bookPools.map((pool) => pool.id)).toEqual(["AllEnchantmentBooks", "EnchantmentBooksCommon"]);
    expect(data["enchantment-book/piercing"]?.bookPools ?? []).toEqual([]);
    expect(data["enchantment-book/radiance"]?.bookPools ?? []).toEqual([]);
    expect(data["enchantment-book/piercing"]?.quests.map((quest) => quest.id)).toEqual(["EnchantsmithBookReward"]);
    expect(data["enchantment-book/ricochet"]?.bookPools.map((pool) => pool.id)).toEqual(["AllEnchantmentBooks", "EnchantmentBooksCommon"]);
    expect(data["enchantment-book/arcane"]?.bookPools[1]?.name.en).toBe("Enchantment book pool: Common");
  });

  it("marks names that fell back to English as untranslated, and leaves official area names alone", () => {
    const sickles = run().data["melee/sickles"];
    expect(sickles?.untranslated).toContain("ja");   // the chest's name is English words
    expect(sickles?.untranslated).not.toContain("en");
    const unique = run().data["melee/sword-unique1"];
    expect(unique).toBeUndefined();   // no source at all -> no entry
  });

  it("leaves out untranslated when every name is the game's own", () => {
    const official = makeLocales({ [ns("VendorLabels")]: { vendor_village_merchant_title: { en: "Town Merchant", zh: "城鎮商人" } } });
    const keys = { VillageMerchant: { namespace: ns("VendorLabels"), key: "vendor_village_merchant_title" } };
    const generic = [base.generic[0]!];
    const sword = run({ generic, quest: [], lootActor: [] }, keys, official).data["melee/sword"];
    expect(sword?.merchants).toHaveLength(1);
    expect(sword && "untranslated" in sword).toBe(false);
  });

  it("reports data problems: odd spellings, odd row names, tags that match no item", () => {
    const tables = {
      quest: [...base.quest, lootRow("QuestSpring", "SW.Quest.Loot.S", [slot("SpecialGear", 1, 0, 1, false, ["SW.Item.Currency.SpringStone", "SW.Item.Currency.Springstone", "SW.Item.Nothing", "sw.Item.Talisman.Llama"])])],
    };
    const { issues } = run(tables);
    expect(issues).toContainEqual({ type: "loot-tag-case", detail: "SW.Item.Currency.SpringStone | SW.Item.Currency.Springstone" });
    expect(issues).toContainEqual({ type: "loot-row-name", detail: "QuestMeleeDaggerUnique_)1" });
    expect(issues).toContainEqual({ type: "loot-tag-unmatched", detail: "SW.Item.Nothing" });
    expect(issues).toContainEqual({ type: "loot-tag-unmatched", detail: "sw.Item.Talisman.Llama" });
    expect(issues.some((item) => item.type === "loot-tag-unmatched" && item.detail.includes("Currency"))).toBe(false);
  });

  it("reports a category tag that no item carries, but not one that resolves", () => {
    const area = [...base.area, lootRow("CampA2", "SW.Area.Camp.A2", [slot("Item", 0, 0, 0, true, [["SW.Item.Property.Gear", 0, "Multiply"]])])];
    const unmatched = run({ area }).issues.filter((item) => item.type === "loot-tag-unmatched").map((item) => item.detail);
    expect(unmatched).toContain("SW.Item.Property.Gear");
    expect(unmatched).not.toContain("SW.Item.Property.MeleeWeapon");
    expect(unmatched).not.toContain("SW.Item.Property.EnchantmentBook");
  });

  it("does not change its input tables", () => {
    const tables = lootTables(base);
    const before = JSON.stringify(tables);
    buildItemSources({ tables, index: buildItemIndex(tables, entries), namer, locales });
    expect(JSON.stringify(tables)).toBe(before);
  });
});

const hasSourceData = existsSync("source-data/DataTables/UFS/DT_LootSourceDefinition_Area.json");
describe.skipIf(!hasSourceData)("real source-data", () => {
  let cached: Promise<ReturnType<typeof buildItemSources>> | undefined;
  const real = () => {
    cached ??= (async () => {
      const [realLocales, mobs, loot] = await Promise.all([loadLocales("source-data"), loadMobTables("source-data"), loadLootTables("source-data")]);
      if (!mobs || !loot) throw new Error("tables missing");
      const all = z.array(EntrySchema).parse(JSON.parse(readFileSync("src/data/entries.json", "utf8")));
      return buildItemSources({ tables: loot, index: buildItemIndex(loot, all), namer: buildAreaNamer(mobs.areas, realLocales), locales: realLocales });
    })();
    return cached;
  };

  it("finds sources for a couple of hundred items, never a merchant for a unique one", async () => {
    const { data } = await real();
    expect(Object.keys(data).length).toBeGreaterThan(200);
    expect(Object.keys(data).length).toBeLessThan(320);
    expect(Object.entries(data).filter(([key, sources]) => sources.merchants.length > 0 && key.endsWith("unique")).map(([key]) => key)).toEqual([]);
  });

  it("gives Sickles its areas, the area chests, its quest and the town merchant's melee category", async () => {
    const sickles = (await real()).data["melee/sickles"];
    expect(sickles?.areas.map((area) => area.areaId)).toContain("SW.Area.Plains.A1");
    expect(sickles?.chests.map((chest) => `${chest.id}:${chest.pool}`)).toEqual(["FancyChest:area", "WellspringChest:area"]);
    expect(sickles?.quests.map((quest) => quest.id)).toEqual(["QuestMeleeSickles"]);
    expect(sickles?.merchants).toEqual([expect.objectContaining({ id: "VillageMerchant", category: "SW.Item.Property.MeleeWeapon" })]);
    expect(sickles?.merchants[0]?.name.zh).toBe("城鎮商人");
  });

  it("says 2 of 4 for the mushroom chestplate's quest", async () => {
    const quest = (await real()).data["armor/mushroom-chest"]?.quests.find((item) => item.id === "QuestArmourMushroomSet");
    expect(quest?.picks).toEqual({ count: 2, of: 4 });
  });

  it("keeps Piercing out of the all-books pool but lists the enchantsmith quest", async () => {
    const { data } = await real();
    expect(data["enchantment-book/piercing"]?.bookPools ?? []).toEqual([]);
    expect(data["enchantment-book/piercing"]?.quests.map((quest) => quest.id)).toEqual(["QuestEnchantsmithBookReward"]);
    expect(data["enchantment-book/ricochet"]?.bookPools.map((pool) => pool.id)).toEqual(["AllEnchantmentBooks", "EnchantmentBooksDeepDark"]);
  });

  it("reports the known data problems", async () => {
    const { issues } = await real();
    expect(issues).toContainEqual({ type: "loot-tag-unmatched", detail: "sw.Item.Talisman.Llama" });
    expect(issues).toContainEqual({ type: "loot-row-name", detail: "QuestMeleeDaggerUnique_)1" });
    expect(issues).toContainEqual({ type: "loot-tag-case", detail: "SW.Item.Currency.SpringStone | SW.Item.Currency.Springstone" });
    expect(issues).toContainEqual({ type: "loot-slot-unnamed", detail: "CampWoodenChest" });
    expect(issues.filter((item) => item.type === "loot-tag-unmatched").map((item) => item.detail).sort()).toEqual(["SW.Item.Property.Consumable", "SW.Item.Property.Gear", "sw.Item.Talisman.Llama"]);
    expect(issues.filter((item) => item.type === "loot-quest-not-guaranteed")).toEqual([]);
  });
});
