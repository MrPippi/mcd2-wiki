import { describe, expect, it } from "vitest";
import { buildUniverse } from "../../../scripts/extract/drop-universe";
import { makeEntry } from "../../helpers/entries";
import { dropLoot, gear } from "../../helpers/drop-tables";

const SPAWN = "SW.Property.Spawnable";
const loot = dropLoot({
  melee: [
    gear("melee", "Sword", "SW.Item.Sword", { traits: [SPAWN, "SW.Item.Property.MeleeWeapon"], sub: "SW.Item.Sword_Unique1" }),
    gear("melee", "Sword_Unique1", "SW.Item.Sword_Unique1", { traits: [SPAWN, "SW.Item.Property.MeleeWeapon", "SW.Item.Property.Unique"], rarities: ["SW.Rarity.Unique"] }),
    gear("melee", "BaseMeleeWeapon", "SW.Item.Base", { traits: ["SW.Item.Property.MeleeWeapon"] }),
  ],
  armor: [
    gear("armor", "MysticHelmet", "SW.Item.MysticHelmet", { traits: [SPAWN, "SW.Item.Property.Armor.Helmet", "SW.Item.ArmorSet.Mystic"], parents: ["SW.Item.Property.Armor"] }),
    gear("armor", "MysticChest", "SW.Item.MysticChest", { traits: [SPAWN, "SW.Item.Property.Armor.Chest", "SW.Item.ArmorSet.Mystic"], parents: ["SW.Item.Property.Armor"] }),
    gear("armor", "Template", "SW.Item.Property.Armor.Helmet", { traits: ["SW.Item.Property.Armor"] }),
  ],
  artifact: [
    gear("artifact", "Quiver", "SW.Item.Artifact.Quiver", { traits: ["SW.Item.Property.Artifact", "SW.Archetype.Ranger"] }),
    gear("artifact", "FlameQuiver", "SW.Item.Artifact.FlameQuiver", { traits: [SPAWN, "SW.Item.Artifact.Quiver"] }),
    gear("artifact", "Totem", "SW.Item.Artifact.Totem", { traits: [SPAWN] }),
  ],
  enchantmentBook: [gear("enchantmentBook", "Arcane", "SW.Item.EnchantmentBook.Arcane", { traits: [SPAWN, "SW.Item.Property.EnchantmentBook"] })],
});
const entries = [
  makeEntry("Sword", "melee"),
  makeEntry("Sword_Unique1", "melee"),
  makeEntry("MysticHelmet", "armor"),
  makeEntry("FlameQuiver", "artifact"),
  makeEntry("Arcane", "enchantment-book"),
];
const universe = buildUniverse(loot, entries);

describe("buildUniverse", () => {
  it("keeps real items only: templates and Base rows are not drawable", () => {
    expect([...universe.items.keys()].sort()).toEqual(
      ["sw.item.artifact.flamequiver", "sw.item.artifact.totem", "sw.item.enchantmentbook.arcane", "sw.item.mystichelmet", "sw.item.mysticchest", "sw.item.sword", "sw.item.sword_unique1"].sort(),
    );
  });

  it("names a group tag's members: a property, an armor set, and an item by its own tag", () => {
    expect(universe.membersOf("SW.Item.Property.MeleeWeapon")).toEqual(["sw.item.sword", "sw.item.sword_unique1"]);
    expect(universe.membersOf("sw.item.armorset.mystic")).toEqual(["sw.item.mystichelmet", "sw.item.mysticchest"]);
    expect(universe.membersOf("SW.Item.Sword")).toEqual(["sw.item.sword"]);
    expect(universe.membersOf("SW.Item.Currency.SpringStone")).toEqual([]);
  });

  it("gives an item the traits of the item row whose tag it carries, and every artifact the artifact tag", () => {
    expect(universe.membersOf("SW.Item.Property.Artifact")).toEqual(["sw.item.artifact.flamequiver", "sw.item.artifact.totem"]);
    expect(universe.membersOf("SW.Archetype.Ranger")).toEqual(["sw.item.artifact.flamequiver"]);
  });

  it("joins items to the site's entries", () => {
    expect(universe.items.get("sw.item.sword")?.key).toBe("melee/sword");
    expect(universe.items.get("sw.item.enchantmentbook.arcane")?.key).toBe("enchantment-book/arcane");
    expect(universe.items.get("sw.item.artifact.totem")?.key).toBeUndefined();
  });

  it("knows the Unique variant of an item, and which items are Unique only", () => {
    expect(universe.items.get("sw.item.sword")).toMatchObject({ sub: "sw.item.sword_unique1", uniqueOnly: false });
    expect(universe.items.get("sw.item.sword_unique1")).toMatchObject({ uniqueOnly: true });
  });

  it("groups gear for the recent-drop history: weapon type, artifact, armor piece; anything else on its own", () => {
    expect(universe.groupOf("sw.item.sword")).toBe("sw.item.property.meleeweapon");
    expect(universe.groupOf("sw.item.sword_unique1")).toBe("sw.item.property.meleeweapon");
    expect(universe.groupOf("sw.item.mystichelmet")).toBe("sw.item.property.armor.helmet");
    expect(universe.groupOf("sw.item.artifact.flamequiver")).toBe("sw.item.property.artifact");
    expect(universe.groupOf("sw.item.enchantmentbook.arcane")).toBe("sw.item.enchantmentbook.arcane");
    expect(universe.groupOf("~sw.item.currency.springstone")).toBe("~sw.item.currency.springstone");
  });
});
