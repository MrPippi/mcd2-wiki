import { describe, expect, it } from "vitest";
import { buildHierarchy, closureOf, createSlotResolver, mergeSlots, type Resolved } from "../../../scripts/extract/drop-slots";
import { poolWeights } from "../../../scripts/extract/drop-pool";
import { lootRow, slot } from "../../helpers/mob-tables";

const ITEMS: Readonly<Record<string, readonly string[]>> = {
  "sw.item.sword": ["sw.item.sword"],
  "sw.item.mace": ["sw.item.mace"],
  "sw.item.book.a": ["sw.item.book.a"],
  "sw.item.book.b": ["sw.item.book.b"],
};
const members = (tag: string): readonly string[] => ITEMS[tag.toLowerCase()] ?? [];

const rows = [
  lootRow("Fancy", "SW.LootActor.FancyChest", [slot("Item", 1, 0, 0, true)]),
  lootRow("Talismans", "SW.LootActor.Talismans", [slot("Talismans", 1, 0, 0, true, ["SW.Item.Talisman.X"])], ["SW.LootActor.FancyChest"]),
  lootRow("Global", "SW.Area", [slot("EnchantedBook", 0, 0, 0, true)], ["SW.LootSource.Books.Common"]),
  lootRow("BooksCommon", "SW.LootSource.Books.Common", [slot("EnchantedBook", 0, 0, 0, false, ["SW.Item.Book.A"])]),
  lootRow("PlainsA1", "SW.Area.Plains.A1", [slot("Item", 0, 0, 0, true, ["SW.Item.Sword", "SW.Item.Mace"])]),
  lootRow("Town", "SW.Area.Town", [slot("Item", 0, 0, 0, true, ["SW.Item.Sword", ["SW.Item.Mace", 0, "Set"]])]),
  lootRow("Boss", "SW.Mob.Boss", [slot("Item", 1, 6, 0.5, true), slot("SpringStone", 5, 5, 0.5, true, ["SW.Item.Currency.SpringStone"])]),
  lootRow("Camp", "SW.LootActor.Camp", [slot("", 1, 0, 1, true, ["SW.Item.Sword"])]),
  lootRow("Closed", "SW.LootActor.Closed", [slot("Item", 1, 0, 0, false, ["SW.Item.Mace"])], ["SW.LootActor.FancyChest"]),
];
const parents = buildHierarchy([...rows, { TypeTag: { TagName: "SW.Area.Overworld" }, Traits: { GameplayTags: [{ TagName: "SW.Area" }] } }, { TypeTag: { TagName: "SW.Area.Plains.A1.Barn" }, Traits: { GameplayTags: [{ TagName: "SW.Area.Plains.A1" }] } }]);
const resolver = createSlotResolver({ rows, parents, membersOf: members });
const weights = (resolved: Resolved | undefined) => Object.fromEntries(resolved ? poolWeights(resolved.pool) : []);

describe("buildHierarchy", () => {
  it("follows the traits of any row, and the tag prefix only where a tag has no traits", () => {
    expect(parents("SW.Area.Plains.A1.Barn")).toEqual(["SW.Area.Plains.A1"]);
    expect(parents("SW.Area.Overworld")).toEqual(["SW.Area"]);
    expect(parents("SW.Area.Plains.A1")).toEqual(["SW.Area.Plains"]);
    expect(parents("SW")).toEqual([]);
  });

  it("matches tags in any spelling of case", () => {
    expect(parents("sw.area.plains.a1.barn")).toEqual(["SW.Area.Plains.A1"]);
  });
});

describe("closureOf", () => {
  it("lists every tag the starting tags reach, nearest first, once", () => {
    expect(closureOf(["SW.LootActor.Talismans"], parents)).toEqual(["sw.lootactor.talismans", "sw.lootactor.fancychest", "sw.lootactor", "sw"]);
  });
});

describe("createSlotResolver", () => {
  it("gives a row's own slot: counts and pool", () => {
    const plains = resolver.resolve("SW.Area.Plains.A1", "item");
    expect(plains).toMatchObject({ guaranteed: 0, rolls: 0, chance: 0 });
    expect(weights(plains)).toEqual({ "sw.item.sword": 1, "sw.item.mace": 1 });
  });

  it("passes a slot through a row that has none: a trait parent supplies it", () => {
    const chest = resolver.resolve("SW.LootActor.Talismans", "item");
    expect(chest).toMatchObject({ guaranteed: 1 });
    expect(weights(chest)).toEqual({});
  });

  it("starts a slot that inherits with the pool of its parents, and lets its own Set replace theirs", () => {
    expect(weights(resolver.resolve("SW.Area.Town", "item"))).toEqual({ "sw.item.sword": 1 });
    expect(weights(resolver.resolve("SW.Area.Plains.A1.Barn", "item"))).toEqual({ "sw.item.sword": 1, "sw.item.mace": 1 });
  });

  it("starts from nothing when the slot does not inherit", () => {
    expect(weights(resolver.resolve("SW.LootActor.Closed", "item"))).toEqual({ "sw.item.mace": 1 });
  });

  it("collects book pools through the traits of the area root", () => {
    expect(weights(resolver.resolve("SW.Area.Plains.A1", "enchantedbook"))).toEqual({ "sw.item.book.a": 1 });
  });

  it("is undefined for a slot nothing in the chain has", () => {
    expect(resolver.resolve("SW.Area.Plains.A1", "talismans")).toBeUndefined();
  });

  it("reads a slot without a name as the slot 'none'", () => {
    expect(weights(resolver.resolve("SW.LootActor.Camp", "none"))).toEqual({ "sw.item.sword": 1 });
  });

  it("names the slots of the chain", () => {
    expect(resolver.slotNames(["SW.LootActor.Talismans", "SW.Area.Plains.A1"])).toEqual(["item", "enchantedbook", "talismans"]);
  });

  it("survives a loop of traits", () => {
    const loop = createSlotResolver({
      rows: [lootRow("A", "SW.A", [slot("Item", 1, 0, 0, true)], ["SW.B"]), lootRow("B", "SW.B", [], ["SW.A"])],
      parents: buildHierarchy([lootRow("A", "SW.A", [], ["SW.B"]), lootRow("B", "SW.B", [], ["SW.A"])]),
      membersOf: members,
    });
    expect(loop.resolve("SW.A", "item")).toMatchObject({ guaranteed: 1 });
  });
});

describe("mergeSlots", () => {
  const one = (guaranteed: number, rolls: number, chance: number, tag = "SW.Item.Sword"): Resolved => {
    const resolved = createSlotResolver({ rows: [lootRow("X", "SW.X", [slot("Item", guaranteed, rolls, chance, true, [tag])])], parents: () => [], membersOf: members }).resolve("SW.X", "item");
    if (!resolved) throw new Error("test row");
    return resolved;
  };

  it("takes the most guaranteed draws and rolls and the mean of the positive chances", () => {
    expect(mergeSlots([one(1, 2, 0.25), one(0, 6, 0.5), one(0, 0, 0)])).toMatchObject({ guaranteed: 1, rolls: 6, chance: 0.375 });
  });

  it("merges the pools and skips what is missing", () => {
    expect(weights(mergeSlots([undefined, one(1, 0, 0), one(1, 0, 0, "SW.Item.Mace")]))).toEqual({ "sw.item.sword": 1, "sw.item.mace": 1 });
    expect(mergeSlots([undefined])).toBeUndefined();
  });
});
