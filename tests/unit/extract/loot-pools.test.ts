import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildItemIndex } from "../../../scripts/extract/loot-items";
import { excludedTags, poolTags, rawSlots, resolvePool, rowPool, tagVariants } from "../../../scripts/extract/loot-pools";
import { slotsOf } from "../../../scripts/extract/loot-slots";
import { loadLootTables, type LootRow, type LootTables } from "../../../scripts/extract/loot-tables";
import { tagKey } from "../../../scripts/extract/mob-tags";
import { EntrySchema } from "../../../scripts/extract/schemas";
import { makeEntry } from "../../helpers/entries";
import { itemRow, lootRow, lootTables, slot } from "../../helpers/mob-tables";

const BOOK = "DT_ItemDefinitionEnchantmentBook";
const tables = lootTables({
  area: [
    lootRow("PlainsA1", "SW.Area.Plains.A1", [slot("Item", 0, 0, 0, true, ["SW.Item.Sword", "SW.Item.Sickles", "SW.Item.ArmorSet.Mushroom"])]),
    lootRow("CampA1", "SW.Area.Camp.A1", [slot("Item", 0, 0, 0, true, [["SW.Item.Sword", 0, "Multiply"]])]),
    lootRow("Peaks", "SW.Area.Peaks.A1", [slot("Item", 0, 0, 0, true, [["SW.Item.Bow", 4, "Set"], "SW.Item.Sword"])]),
  ],
  generic: [
    lootRow("AllEnchantmentBooks", "SW.LootSource.EnchantmentBooksAll", [slot("EnchantedBook", 0, 0, 0, false, [["SW.Item.Property.EnchantmentBook", 100000, "Set"]])], ["SW.LootSource.EnchantmentBooksExcludeQuestBooks"]),
    lootRow("EnchantmentBooksExcludeQuestBooks", "SW.LootSource.EnchantmentBooksExcludeQuestBooks", [slot("", 0, 0, 0, false, [["SW.Item.EnchantmentBook.Piercing", 0, "Multiply"], ["SW.Item.EnchantmentBook.Radiance", 0, "Multiply"]])]),
    lootRow("VillageMerchant", "SW.NPC.VillageMerchant", [slot("Item", 1, 0, 0, false, [["SW.Item.Property.MeleeWeapon", 2, "Set"], ["SW.Item.Property.Unique", 0, "Multiply"], ["SW.Item.ExceptFromDefaultLootTables", 0, "Multiply"]])]),
  ],
  quest: [lootRow("QuestA", "SW.Quest.Loot.A", [slot("SpecialGear", 1, 0, 1, false, ["SW.Item.Currency.SpringStone"])]), lootRow("QuestB", "SW.Quest.Loot.B", [slot("SpecialGear", 1, 0, 1, false, ["SW.Item.Currency.Springstone"])])],
});
const byTag = new Map([...tables.area, ...tables.generic].map((row) => [tagKey(row.TypeTag.TagName), row]));
const item = (row: LootRow | undefined) => (row ? slotsOf(row).get("item") : undefined);

describe("poolTags", () => {
  it("lists the Set tags of the slot, set tags included as written", () => {
    const plains = item(tables.area[0]);
    expect(plains && poolTags(plains)).toContain("SW.Item.Sickles");
    expect(plains && poolTags(plains)).toContain("SW.Item.ArmorSet.Mushroom");
  });

  it("treats Multiply with weight 0 as an exclusion, so a pool with only that is empty", () => {
    const camp = item(tables.area[1]);
    expect(camp && poolTags(camp)).toEqual([]);
  });

  it("keeps entries with other weights (Peaks has a weight-4 entry)", () => {
    const peaks = item(tables.area[2]);
    expect(peaks && poolTags(peaks)).toEqual(["SW.Item.Bow", "SW.Item.Sword"]);
  });

  it("subtracts tags excluded by extra rows, whatever slot they sit in", () => {
    const plains = item(tables.area[0]);
    const exclusion = lootRow("X", "SW.X", [slot("", 0, 0, 0, false, [["sw.item.sword", 0, "Multiply"]])]);
    expect(plains && poolTags(plains, [exclusion])).toEqual(["SW.Item.Sickles", "SW.Item.ArmorSet.Mushroom"]);
  });
});

describe("rowPool", () => {
  it("applies the exclusion row a pool names in its traits, but only to that pool", () => {
    const all = tables.generic[0];
    expect(all && rowPool(all, "enchantedBook", byTag)).toEqual(["SW.Item.Property.EnchantmentBook"]);
    const exclusion = tables.generic[1];
    const only = Object.values(exclusion?.LootDropDefinition.LootSlots ?? {});
    expect(only).toHaveLength(1);
    expect(only[0] && excludedTags(only[0])).toEqual(["SW.Item.EnchantmentBook.Piercing", "SW.Item.EnchantmentBook.Radiance"]);
    expect(exclusion && rawSlots(exclusion)).toEqual(only);
  });

  it("returns an empty pool for a slot the row does not have", () => {
    const camp = tables.area[1];
    expect(camp && rowPool(camp, "talismans", byTag)).toEqual([]);
  });
});

describe("excludedTags", () => {
  it("lists what a merchant row excludes", () => {
    const merchant = item(tables.generic[2]);
    expect(merchant && excludedTags(merchant)).toEqual(["SW.Item.Property.Unique", "SW.Item.ExceptFromDefaultLootTables"]);
  });
});

describe("tagVariants", () => {
  it("groups tags that differ only in spelling, like Springstone and SpringStone", () => {
    expect(tagVariants(tables.quest)).toEqual([["SW.Item.Currency.SpringStone", "SW.Item.Currency.Springstone"]]);
  });
});

describe("resolvePool", () => {
  const books = ["Arcane", "Piercing", "Radiance"];
  const itemTables = lootTables({
    melee: [
      itemRow("DT_ItemDefinitionMelee", "Sword", "SW.Item.Sword", ["SW.Item.Property.MeleeWeapon"]),
      itemRow("DT_ItemDefinitionMelee", "Claws_Unique1", "SW.Item.Claws_Unique1", ["SW.Item.Property.MeleeWeapon", "SW.Item.Property.Unique"]),
    ],
    enchantmentBook: books.map((name) => itemRow(BOOK, `EnchantmentBook_${name}`, `SW.Item.EnchantmentBook.${name}`, ["SW.Item.Property.EnchantmentBook"])),
  });
  const index = buildItemIndex(itemTables, [
    makeEntry("Sword", "melee"),
    makeEntry("Claws_Unique1", "melee"),
    ...books.map((name) => makeEntry(`EnchantmentBook_${name}`, "enchantment-book")),
  ]);

  it("expands the book trait through withTrait, then subtracts the exclusion row", () => {
    const all = tables.generic[0]!;
    const { items, unmatched } = resolvePool(all, "enchantedBook", byTag, index);
    expect(items.map((entry) => entry.ref.key)).toEqual(["enchantment-book/arcane"]);
    expect(items[0]?.weight).toBe(100000);
    expect(unmatched).toEqual([]);
  });

  it("subtracts a Unique exclusion from a category pool, and reports tags nothing matches", () => {
    const merchant = tables.generic[2]!;
    const sold = resolvePool(merchant, "item", byTag, index);
    expect(sold.items.map((entry) => entry.ref.key)).toEqual(["melee/sword"]);
    expect(sold.unmatched).toEqual([]);
    const plains = resolvePool(tables.area[0]!, "item", byTag, index);
    expect(plains.items.map((entry) => entry.ref.key)).toEqual(["melee/sword"]);
    expect(plains.unmatched).toEqual(["SW.Item.Sickles", "SW.Item.ArmorSet.Mushroom"]);
  });
});

const hasSourceData = existsSync("source-data/DataTables/UFS/DT_LootSourceDefinition_Area.json");
describe.skipIf(!hasSourceData)("real source-data", () => {
  async function setup() {
    const real: LootTables | undefined = await loadLootTables("source-data");
    if (!real) throw new Error("loot tables missing");
    const all = z.array(EntrySchema).parse(JSON.parse(readFileSync("src/data/entries.json", "utf8")));
    const rows = [...real.area, ...real.generic, ...real.mob, ...real.lootActor, ...real.quest];
    return { real, index: buildItemIndex(real, all), byTypeTag: new Map(rows.map((row) => [tagKey(row.TypeTag.TagName), row])) };
  }
  const rowOf = (rows: readonly LootRow[], name: string): LootRow => {
    const found = rows.find((row) => row.Name === name);
    if (!found) throw new Error(`row ${name} missing`);
    return found;
  };

  it("leaves CampA1 with an empty pool and gives the open areas their tag counts", async () => {
    const { real, byTypeTag } = await setup();
    expect(rowPool(rowOf(real.area, "CampA1"), "item", byTypeTag)).toEqual([]);
    expect(rowPool(rowOf(real.area, "PlainsA1"), "item", byTypeTag)).toHaveLength(21);
    expect(rowPool(rowOf(real.area, "ForestA1"), "item", byTypeTag)).toHaveLength(30);
  });

  it("keeps the three quest books out of AllEnchantmentBooks", async () => {
    const { real, index, byTypeTag } = await setup();
    const all = resolvePool(rowOf(real.generic, "AllEnchantmentBooks"), "enchantedBook", byTypeTag, index);
    const tags = all.items.map((entry) => entry.ref.tag);
    for (const excluded of ["Piercing", "Radiance", "SoulInfusedPotion"]) expect(tags).not.toContain(`SW.Item.EnchantmentBook.${excluded}`);
    expect(index.withTrait("SW.Item.Property.EnchantmentBook").length - tags.length).toBe(3);
  });

  it("keeps Unique items out of the village merchant", async () => {
    const { real, index, byTypeTag } = await setup();
    const merchant = resolvePool(rowOf(real.generic, "VillageMerchant"), "item", byTypeTag, index);
    expect(merchant.items.length).toBeGreaterThan(100);
    expect(merchant.items.filter((entry) => entry.ref.traits.has("sw.item.property.unique"))).toEqual([]);
    expect(merchant.items.some((entry) => entry.ref.key.startsWith("armor/"))).toBe(true);
    expect(merchant.items.some((entry) => entry.ref.key.startsWith("artifact/"))).toBe(true);
  });
});
