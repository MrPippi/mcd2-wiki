import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildItemIndex } from "../../../scripts/extract/loot-items";
import { buildItemSources } from "../../../scripts/extract/loot-sources";
import { loadLootTables } from "../../../scripts/extract/loot-tables";
import { buildAreaNamer } from "../../../scripts/extract/mob-areas";
import { loadMobTables } from "../../../scripts/extract/mob-tables";
import { loadLocales } from "../../../scripts/extract/parse-locale";
import { ItemSourcesSchema, type ItemSourcesData } from "../../../scripts/extract/mob-schema";
import { EntrySchema } from "../../../scripts/extract/schemas";
import { sourcesFor } from "../../../src/lib/item-sources";
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

function build(overrides: Partial<typeof base> = {}, nameKeys = {}, localeFiles = locales) {
  const tables = lootTables({ ...base, ...overrides });
  return buildItemSources({ tables, index: buildItemIndex(tables, entries), namer, locales: localeFiles, nameKeys });
}

/** Every item's resolved view (names joined), as the page sees it. */
const resolvedAll = (data: ItemSourcesData) => Object.fromEntries(Object.keys(data.items).map((key) => [key, sourcesFor(data, key)]));

function run(overrides: Partial<typeof base> = {}, nameKeys = {}, localeFiles = locales) {
  const built = build(overrides, nameKeys, localeFiles);
  return { raw: built.data, data: resolvedAll(built.data), issues: built.issues };
}

const ids = (list: readonly { id: string }[] | undefined) => (list ?? []).map((item) => item.id);

describe("buildItemSources", () => {
  it("lists the area whose drop pool contains a weapon (PlainsA1 contains Sickles)", () => {
    const sickles = run().data["melee/sickles"];
    expect(sickles?.areas).toEqual([{ id: "area:SW.Area.Plains.A1", kind: "area", name: expect.objectContaining({ en: "Creeper Woods", zh: "苦力怕森林" }), untranslated: [] }]);
  });

  it("names each source once and lists ids on the item (normalised shape)", () => {
    const { raw } = run();
    expect(raw.items["melee/sickles"]).toEqual({
      areas: ["area:SW.Area.Plains.A1"],
      chests: [{ id: "chest:FancyChest", pool: "area" }],
      quests: [],
      merchants: [{ id: "merchant:VillageMerchant", category: "SW.Item.Property.MeleeWeapon" }],
      bookPools: [],
    });
    expect(raw.sources["chest:FancyChest"]).toEqual({ kind: "chest", name: expect.objectContaining({ en: "Fancy Chest" }), untranslated: expect.arrayContaining(["ja"]) });
    expect(ItemSourcesSchema.parse(raw)).toEqual(raw);
  });

  it("lists only sources some item uses", () => {
    const { raw } = run();
    const used = new Set(Object.values(raw.items).flatMap((item) => [...item.areas, ...item.bookPools, ...[...item.chests, ...item.quests, ...item.merchants].map((entry) => entry.id)]));
    expect(Object.keys(raw.sources).sort()).toEqual([...used].sort());
  });

  it("expands an armor set tag so each piece has the area", () => {
    const { data } = run();
    expect(ids(data["armor/mystic-helmet"]?.areas)).toEqual(["area:SW.Area.Plains.A1"]);
    expect(ids(data["armor/mystic-chest"]?.areas)).toEqual(["area:SW.Area.Plains.A1"]);
    expect(data["armor/mushroom-helmet"]?.areas).toEqual([]);
  });

  it("treats Multiply 0 as an exclusion: CampA1 and the global row add nothing to Sword's areas", () => {
    expect(run().data["melee/sword"]?.areas ?? []).toEqual([]);
  });

  it("names an area without a game name in English words, marks that source untranslated and reports it", () => {
    const area = [...base.area, lootRow("ForestA1", "SW.Area.Forest.A1.Inner", [slot("Item", 0, 0, 0, true, ["SW.Item.Sickles"])])];
    const { data, issues } = run({ area });
    const forest = data["melee/sickles"]?.areas.find((item) => item.id === "area:SW.Area.Forest.A1");
    expect(forest?.name.en).toBe("Forest A1");
    expect(forest?.name.ja).toBe("Forest A1");
    expect(forest?.untranslated).toContain("zh");
    expect(issues).toContainEqual({ type: "source-name-fallback", detail: "SW.Area.Forest.A1" });
  });

  it("lists guaranteed quest rewards and says 2 of 4 for the mushroom set", () => {
    const { data } = run();
    expect(data["armor/mushroom-chest"]?.quests).toEqual([
      expect.objectContaining({ id: "quest:QuestArmourMushroomSet", name: expect.objectContaining({ en: "Quest reward", zh: "任務獎勵" }), picks: { count: 2, of: 4 } }),
    ]);
    expect(data["melee/sword"]?.quests).toEqual([{ id: "quest:QuestMeleeSword", kind: "quest", name: expect.objectContaining({ en: "Quest reward" }), untranslated: [] }]);
  });

  it("ignores a quest row that is not guaranteed, and reports it", () => {
    const { data, issues } = run();
    expect(data["melee/sickles"]?.quests ?? []).toEqual([]);
    expect(issues).toContainEqual({ type: "loot-quest-not-guaranteed", detail: "QuestRandomSickles" });
  });

  it("counts a quest with no fixed drop but a certain roll as guaranteed", () => {
    const quest = [lootRow("QuestCertainSickles", "SW.Quest.Loot.Melee.Sickles", [slot("SpecialGear", 0, 1, 1, false, ["SW.Item.Sickles"])])];
    expect(ids(run({ quest }).data["melee/sickles"]?.quests)).toEqual(["quest:QuestCertainSickles"]);
  });

  it("separates chests that draw from the area pool from chests with fixed contents", () => {
    const { data } = run();
    expect(data["melee/sickles"]?.chests).toEqual([expect.objectContaining({ id: "chest:FancyChest", name: expect.objectContaining({ en: "Fancy Chest" }), pool: "area" })]);
    expect(data["artifact/firework-quiver"]?.chests).toEqual([expect.objectContaining({ id: "chest:CampWoodenChest", name: expect.objectContaining({ en: "Camp Wooden Chest" }), pool: "fixed" })]);
    expect(data["melee/sword"]?.chests ?? []).toEqual([]);   // Sword is in no area pool, so the fancy chest cannot give it
  });

  it("does not spread a chest's category pool over every item, and reports it", () => {
    const lootActor = [...base.lootActor, lootRow("KeyChest", "SW.LootActor.KeyChest", [slot("Item", 1, 0, 0, false, ["SW.Item.Property.MeleeWeapon"])])];
    const { data, issues } = run({ lootActor });
    expect(data["melee/sword"]?.chests ?? []).toEqual([]);
    expect(issues).toContainEqual({ type: "loot-chest-by-category", detail: "KeyChest: SW.Item.Property.MeleeWeapon" });
  });

  it("counts an unnamed slot's item list as the chest's fixed contents, and still reports the slot", () => {
    const lootActor = [lootRow("CampWoodenChest", "SW.LootActor.CampWoodenChest", [slot("", 1, 0, 1, true, ["SW.Item.Artifact.FireworkQuiver"])])];
    const { raw, issues } = run({ lootActor });
    expect(raw.items["artifact/firework-quiver"]?.chests).toEqual([{ id: "chest:CampWoodenChest", pool: "fixed" }]);
    expect(issues).toContainEqual({ type: "loot-slot-unnamed", detail: "CampWoodenChest" });
  });

  it("gives merchants by category only, keeps the category tag, and not for unique items", () => {
    const { data } = run();
    expect(data["melee/sword"]?.merchants).toEqual([
      expect.objectContaining({ id: "merchant:VillageMerchant", name: expect.objectContaining({ en: "Village Merchant" }), category: "SW.Item.Property.MeleeWeapon" }),
    ]);
    expect(data["melee/sword-unique1"]?.merchants ?? []).toEqual([]);
    expect(data["armor/mushroom-chest"]?.merchants ?? []).toEqual([]);
  });

  it("does not make a merchant source from an exact item tag", () => {
    const generic = [lootRow("VillageMerchant", "SW.NPC.VillageMerchant", [slot("Item", 1, 0, 0, false, ["SW.Item.Sickles"])])];
    expect(run({ generic }).data["melee/sickles"]?.merchants).toEqual([]);
  });

  it("uses the game's merchant title when the key is known, with nothing untranslated", () => {
    const official = makeLocales({ [ns("VendorLabels")]: { vendor_village_merchant_title: { en: "Town Merchant", zh: "城鎮商人" } } });
    const keys = { VillageMerchant: { namespace: ns("VendorLabels"), key: "vendor_village_merchant_title" } };
    const merchant = run({}, keys, official).data["melee/sword"]?.merchants[0];
    expect(merchant?.name.zh).toBe("城鎮商人");
    expect(merchant?.untranslated).toEqual([]);
  });

  it("puts books in their pools, drops the excluded quest books from the all-books pool, and still lists them as quest rewards", () => {
    const { data } = run();
    expect(ids(data["enchantment-book/arcane"]?.bookPools)).toEqual(["bookPool:AllEnchantmentBooks", "bookPool:EnchantmentBooksCommon"]);
    expect(data["enchantment-book/piercing"]?.bookPools ?? []).toEqual([]);
    expect(data["enchantment-book/radiance"]?.bookPools ?? []).toEqual([]);
    expect(ids(data["enchantment-book/piercing"]?.quests)).toEqual(["quest:EnchantsmithBookReward"]);
    expect(ids(data["enchantment-book/ricochet"]?.bookPools)).toEqual(["bookPool:AllEnchantmentBooks", "bookPool:EnchantmentBooksCommon"]);
    expect(data["enchantment-book/arcane"]?.bookPools[1]?.name.en).toBe("Common");
  });

  it("keeps the untranslated languages on the source, never on the item, and leaves official area names alone", () => {
    const { raw, data } = run();
    expect(raw.sources["chest:FancyChest"]?.untranslated).toContain("ja");   // the chest's name is English words
    expect(raw.sources["chest:FancyChest"]?.untranslated).not.toContain("en");
    expect(raw.sources["area:SW.Area.Plains.A1"]?.untranslated).toEqual([]);
    expect(Object.values(raw.items).some((item) => "untranslated" in item)).toBe(false);
    expect(data["melee/sword-unique1"]).toBeUndefined();   // no source at all -> no entry
    expect(sourcesFor(raw, "melee/sword-unique1")).toBeUndefined();
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

const UNIQUE_SLUG = /-unique\d*$/;
const hasSourceData =existsSync("source-data/DataTables/UFS/DT_LootSourceDefinition_Area.json");
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
  const view = async (key: string) => sourcesFor((await real()).data, key);

  it("recognises unique slugs with and without a number", () => {
    expect(["sword-unique", "sword-unique1", "sword-unique12"].map((slug) => UNIQUE_SLUG.test(slug))).toEqual([true, true, true]);
    expect(["sword", "unique-sword", "sword-uniquex"].map((slug) => UNIQUE_SLUG.test(slug))).toEqual([false, false, false]);
  });

  it("never sells the two totems without the artifact trait or the five quivers at the merchant", async () => {
    const keys = ["totem-of-casting", "totem-of-regeneration", "firework-quiver", "flame-quiver", "frost-quiver", "lightning-quiver", "poison-quiver"];
    const merchants = await Promise.all(keys.map(async (slug) => (await view(`artifact/${slug}`))?.merchants.length));
    expect(merchants).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("finds sources for a couple of hundred items, never a merchant for a unique one, and fits the size limit", async () => {
    const { data } = await real();
    const keys = Object.keys(data.items);
    expect(keys.length).toBeGreaterThan(200);
    expect(keys.length).toBeLessThan(320);
    expect(Object.entries(data.items).filter(([key, item]) => item.merchants.length > 0 && UNIQUE_SLUG.test(key)).map(([key]) => key)).toEqual([]);
    expect(JSON.stringify(data).length).toBeLessThan(200_000);
  });

  it("gives Sickles its areas, the area chests, its quest and the town merchant's melee category", async () => {
    const sickles = await view("melee/sickles");
    expect(ids(sickles?.areas)).toContain("area:SW.Area.Plains.A1");
    expect(sickles?.chests.map((chest) => `${chest.id}:${chest.pool}`)).toEqual(["chest:FancyChest:area", "chest:WellspringChest:area"]);
    expect(ids(sickles?.quests)).toEqual(["quest:QuestMeleeSickles"]);
    expect(sickles?.merchants).toEqual([expect.objectContaining({ id: "merchant:VillageMerchant", category: "SW.Item.Property.MeleeWeapon" })]);
    expect(sickles?.merchants[0]?.name.zh).toBe("城鎮商人");
  });

  it("says 2 of 4 for the mushroom chestplate's quest", async () => {
    const quest = (await view("armor/mushroom-chest"))?.quests.find((item) => item.id === "quest:QuestArmourMushroomSet");
    expect(quest?.picks).toEqual({ count: 2, of: 4 });
  });

  it("gives the Firework Quiver the camp chest's fixed contents", async () => {
    const chests = (await view("artifact/firework-quiver"))?.chests ?? [];
    expect(chests).toContainEqual(expect.objectContaining({ id: "chest:CampWoodenChest", pool: "fixed" }));
  });

  it("keeps Piercing out of the all-books pool but lists the enchantsmith quest", async () => {
    expect((await view("enchantment-book/piercing"))?.bookPools ?? []).toEqual([]);
    expect(ids((await view("enchantment-book/piercing"))?.quests)).toEqual(["quest:QuestEnchantsmithBookReward"]);
    expect(ids((await view("enchantment-book/ricochet"))?.bookPools)).toEqual(["bookPool:AllEnchantmentBooks", "bookPool:EnchantmentBooksDeepDark"]);
  });

  it("lists Wonderful Wheat's guaranteed quest", async () => {
    expect(ids((await view("talisman/llama"))?.quests)).toEqual(["quest:QuestTalismanLlama"]);
  });

  it("reports the known data problems", async () => {
    const { issues } = await real();
    expect(issues).toContainEqual({ type: "loot-row-name", detail: "QuestMeleeDaggerUnique_)1" });
    expect(issues).toContainEqual({ type: "loot-tag-case", detail: "SW.Item.Currency.SpringStone | SW.Item.Currency.Springstone" });
    expect(issues).toContainEqual({ type: "loot-slot-unnamed", detail: "CampWoodenChest" });
    expect(issues.filter((item) => item.type === "loot-tag-unmatched").map((item) => item.detail).sort()).toEqual(["SW.Item.Property.Consumable", "SW.Item.Property.Gear"]);   // sw.Item.Talisman.Llama now resolves to Wonderful Wheat
    expect(issues.filter((item) => item.type === "loot-quest-not-guaranteed")).toEqual([]);
  });
});
