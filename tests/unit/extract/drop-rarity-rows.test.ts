import { describe, expect, it } from "vitest";
import { contextRarityOps, difficultyRarityOps, type RarityRow } from "../../../scripts/extract/drop-rarity-rows";

const entry = (rarity: string, weight: number, op: "Set" | "Add" | "Multiply") => ({ TypeTag: { TagName: `SW.Rarity.${rarity}` }, Weight: weight, Operation: op });
const row = (tag: string, entries: ReturnType<typeof entry>[] = [], traits: string[] = []): RarityRow => ({
  TypeTag: { TagName: tag },
  ...(traits.length > 0 ? { Traits: { GameplayTags: traits.map((TagName) => ({ TagName })) } } : {}),
  TagList: entries.length > 0 ? { Tags: entries } : {},
});

const ROWS: RarityRow[] = [
  row("SW.RarityChanceDefinition.Default", [entry("Common", 50, "Set"), entry("Rare", 25, "Set"), entry("Special", 20, "Set"), entry("Unique", 5, "Set")]),
  row("SW.Player", [], ["SW.RarityChanceDefinition.Default"]),
  row("SW.LootActor.FancyChest", [entry("Common", 0, "Multiply")]),
  row("SW.Item.Property.Talisman", [entry("None", 1000000, "Set")]),
  row("SW.Difficulty.Low", [entry("Special", 0, "Multiply"), entry("Unique", 0, "Multiply")]),
];

describe("contextRarityOps", () => {
  it("always includes the player's rows, which lead to the default weights", () => {
    expect(contextRarityOps([], ROWS)).toEqual([[0, "s", 50], [1, "s", 25], [2, "s", 20], [3, "s", 5]]);
  });

  it("adds the rows of every tag of the context, in any case, and leaves None out", () => {
    const ops = contextRarityOps(["sw.lootactor.fancychest", "SW.Item.Property.Talisman"], ROWS);
    expect(ops).toContainEqual([0, "m", 0]);
    expect(ops).toHaveLength(5);
  });

  it("reads each tag once", () => {
    expect(contextRarityOps(["SW.Player", "sw.player"], ROWS)).toHaveLength(4);
  });

  it("follows the traits of a row even when they loop", () => {
    const loop = [row("SW.A", [entry("Rare", 1, "Set")], ["SW.B"]), row("SW.B", [entry("Special", 1, "Set")], ["SW.A"])];
    expect(contextRarityOps(["SW.A"], loop)).toEqual([[1, "s", 1], [2, "s", 1]]);
  });
});

describe("difficultyRarityOps", () => {
  it("is the row of the difficulty's tag", () => {
    expect(difficultyRarityOps("SW.Difficulty.Low", ROWS)).toEqual([[2, "m", 0], [3, "m", 0]]);
  });

  it("is empty for a difficulty with no row", () => {
    expect(difficultyRarityOps("SW.Difficulty.Normal", ROWS)).toEqual([]);
  });
});
