import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildItemIndex } from "../../../scripts/extract/loot-items";
import { loadLootTables } from "../../../scripts/extract/loot-tables";
import { EntrySchema } from "../../../scripts/extract/schemas";
import { makeEntry } from "../../helpers/entries";
import { itemRow, lootTables } from "../../helpers/mob-tables";

const MELEE = "DT_ItemDefinitionMelee";
const ARMOR = "DT_ItemDefinitionArmor";
const tables = lootTables({
  melee: [
    itemRow(MELEE, "Sickles", "SW.Item.Sickles", ["SW.Item.Property.MeleeWeapon"]),
    itemRow(MELEE, "Sword", "SW.Item.Sword", ["SW.Item.Property.MeleeWeapon"]),
    itemRow(MELEE, "Claws_Unique1", "SW.Item.Claws_Unique1", ["SW.Item.Property.MeleeWeapon", "SW.Item.Property.Unique"]),
    itemRow(MELEE, "Hidden", "SW.Item.Hidden", []),
  ],
  armor: [
    ...["Helmet", "Chest", "Leggings", "Boots"].map((piece) => itemRow(ARMOR, `Mushroom${piece}`, `SW.Item.Mushroom${piece}`, ["SW.Item.ArmorSet.Mushroom"])),
    ...["Helmet", "Chest"].map((piece) => itemRow(ARMOR, `Mushroom${piece}_Unique`, `SW.Item.Mushroom${piece}_Unique`, ["SW.Item.Property.Unique", "SW.Item.ArmorSet.Mushroom_Unique"])),
  ],
});
const entries = [
  makeEntry("Sickles", "melee"),
  makeEntry("Sword", "melee"),
  makeEntry("Claws_Unique1", "melee"),
  ...["Helmet", "Chest", "Leggings", "Boots"].map((piece) => makeEntry(`Mushroom${piece}`, "armor")),
  ...["Helmet", "Chest"].map((piece) => makeEntry(`Mushroom${piece}_Unique`, "armor")),
];
const index = buildItemIndex(tables, entries);

describe("buildItemIndex", () => {
  it("resolves an item tag to its entry, ignoring case and the Sw. typo", () => {
    expect(index.resolve("SW.Item.Sickles").map((ref) => ref.key)).toEqual(["melee/sickles"]);
    expect(index.resolve("sw.item.SICKLES")).toHaveLength(1);
    expect(index.resolve("Sw.Item.Sickles")).toHaveLength(1);
  });

  it("does not treat an underscore name as a child of its base tag", () => {
    expect(index.resolve("SW.Item.Claws")).toEqual([]);
    expect(index.resolve("SW.Item.Claws_Unique1").map((ref) => ref.key)).toEqual(["melee/claws-unique1"]);
  });

  it("expands an armor set tag into its four pieces, and keeps the Unique set separate", () => {
    expect(index.resolve("SW.Item.ArmorSet.Mushroom").map((ref) => ref.key)).toEqual(["armor/mushroom-helmet", "armor/mushroom-chest", "armor/mushroom-leggings", "armor/mushroom-boots"]);
    expect(index.resolve("SW.Item.ArmorSet.Mushroom_Unique").map((ref) => ref.key)).toEqual(["armor/mushroom-helmet-unique", "armor/mushroom-chest-unique"]);
  });

  it("finds items by trait for the merchants' category tags", () => {
    expect(index.withTrait("SW.Item.Property.MeleeWeapon").map((ref) => ref.key).sort()).toEqual(["melee/claws-unique1", "melee/sickles", "melee/sword"]);
  });

  it("skips item rows that have no entry on the site", () => {
    expect(index.resolve("SW.Item.Hidden")).toEqual([]);
    expect(index.knownTag("SW.Item.Hidden")).toBe(false);
    expect(index.knownTag("SW.Item.ArmorSet.Mushroom")).toBe(true);
  });

  it("finds a row whose name key starts with sw_ in lower case, and lists rows with no site entry", () => {
    const talismans = lootTables({ talisman: [itemRow("DT_ItemDefinitionTalisman", "LlamaTalisman", "sw.Item.Talisman.Llama", [], "sw_Item_Talisman_Llama_SW_TextEntry_Name")] });
    const llama = buildItemIndex(talismans, [makeEntry("Talisman_Llama", "talisman")]);
    expect(llama.resolve("SW.Item.Talisman.Llama").map((ref) => ref.key)).toEqual(["talisman/llama"]);
    expect(llama.unresolvedRows).toEqual([]);
    expect(index.unresolvedRows).toEqual(["melee:Hidden"]);
  });

  it("counts parent tags as traits, so a category only listed in ParentTags still matches", () => {
    const base = itemRow(ARMOR, "ScampHelmet", "SW.Item.ScampHelmet", ["SW.Item.ArmorSet.Scamp"]);
    const parented = lootTables({
      armor: [{ ...base, Traits: { GameplayTags: [{ TagName: "SW.Item.ArmorSet.Scamp" }], ParentTags: [{ TagName: "SW.Item.Property.Armor" }] } }],
    });
    const parentIndex = buildItemIndex(parented, [makeEntry("ScampHelmet", "armor")]);
    expect(parentIndex.withTrait("SW.Item.Property.Armor").map((ref) => ref.key)).toEqual(["armor/scamp-helmet"]);
  });
});

const hasSourceData = existsSync("source-data/DataTables/UFS/DT_LootSourceDefinition_Area.json");
describe.skipIf(!hasSourceData)("real source-data", () => {
  const load = async () => {
    const real = await loadLootTables("source-data");
    if (!real) throw new Error("loot tables missing");
    const all = z.array(EntrySchema).parse(JSON.parse(readFileSync("src/data/entries.json", "utf8")));
    return buildItemIndex(real, all);
  };

  it("expands the Mushroom set to its 4 pieces and keeps the _Unique set apart", async () => {
    const real = await load();
    const normal = real.resolve("SW.Item.ArmorSet.Mushroom").map((ref) => ref.key);
    const unique = real.resolve("SW.Item.ArmorSet.Mushroom_Unique").map((ref) => ref.key);
    expect(normal).toEqual(["armor/mushroom-helmet", "armor/mushroom-chest", "armor/mushroom-leggings", "armor/mushroom-boots"]);
    expect(unique).toHaveLength(4);
    expect(unique.every((key) => key.endsWith("-unique"))).toBe(true);
    expect(real.resolve("SW.Item.Sickles")).toHaveLength(1);
  });

  it("resolves Wonderful Wheat, whose row key is spelled sw_Item_Talisman_Llama", async () => {
    const real = await load();
    expect(real.resolve("sw.Item.Talisman.Llama").map((ref) => ref.key)).toEqual(["talisman/llama"]);
  });

  it("finds the merchant categories by trait, including armor that only lists Property.Armor as a parent", async () => {
    const real = await load();
    expect(real.withTrait("SW.Item.Property.Armor").length).toBeGreaterThanOrEqual(150);
    expect(real.withTrait("SW.Item.Property.MeleeWeapon").length).toBeGreaterThan(50);
    expect(real.withTrait("SW.Item.Property.Artifact").length).toBeGreaterThan(30);
  });
});
