import { describe, expect, it } from "vitest";
import { emeraldsOf, itemsBySource, rewardRowNames, rewardsOf, rowsByTag, type RewardContext } from "../../../scripts/extract/quest-rewards";
import type { ItemSourcesData } from "../../../scripts/extract/mob-schema";
import { localizedFrom } from "../../../src/lib/lang";
import { lootEntry, lootRow, rawQuest, SIZE_ROWS } from "../../helpers/quest-tables";

const noSources = { areas: [], chests: [], merchants: [], bookPools: [] };
const SOURCES: ItemSourcesData = {
  sources: {},
  items: {
    "armor/phantom-boots": { ...noSources, quests: [{ id: "quest:QuestArmourPhantomSet", picks: { count: 1, of: 2 } }] },
    "armor/phantom-helmet": { ...noSources, quests: [{ id: "quest:QuestArmourPhantomSet", picks: { count: 1, of: 2 } }] },
    "melee/axe": { ...noSources, quests: [{ id: "quest:QuestMeleeAxe" }] },
  },
};
const ROWS = rowsByTag([
  ...SIZE_ROWS,
  lootRow("QuestMeleeAxe", "SW.Quest.Loot.Melee.Axe", [{ slot: "SpecialGear", guaranteed: 1, items: ["SW.Item.Axe"] }]),
  lootRow("QuestArmourPhantomSet", "SW.Quest.Loot.Armour.PhantomSet", [{ slot: "SpecialGear", guaranteed: 1, items: ["a", "b"] }]),
  lootRow("QuestTalismanEmpty", "SW.Quest.Loot.Talisman.Empty"),
  lootRow("QuestAreaLootDropModifier", "sw.quest.loot.AreaDropModifier"),
]);
const FOREST = localizedFrom(() => "Howling Woods");
const CTX: RewardContext = {
  rowsByTag: ROWS,
  items: itemsBySource(SOURCES),
  namer: (tag) => (tag.toLowerCase() === "sw.area.forest.a1" ? FOREST : undefined),
};

describe("itemsBySource", () => {
  it("lists each quest source's items in key order with its picks", () => {
    const items = itemsBySource(SOURCES);
    expect(items.get("quest:QuestArmourPhantomSet")).toEqual({ items: ["armor/phantom-boots", "armor/phantom-helmet"], picks: { count: 1, of: 2 } });
    expect(items.get("quest:QuestMeleeAxe")).toEqual({ items: ["melee/axe"] });
  });
});

describe("rowsByTag", () => {
  it("keeps the first row of a tag, case-insensitively", () => {
    expect(ROWS.get("sw.quest.loot.areadropmodifier")?.Name).toBe("QuestAreaLootDropModifier");
  });
});

describe("rewardsOf", () => {
  it("gives the items of a joined row with the fixed rarity of its entry", () => {
    const built = rewardsOf([lootEntry("SW.Quest.Loot.Melee.Axe", "SW.RarityChance.Quest.Rare")], CTX, "CA02 first");
    expect(built.rewards).toEqual([{ kind: "items", source: "quest:QuestMeleeAxe", items: ["melee/axe"], rarity: "rare" }]);
    expect(built.issues).toEqual([]);
  });
  it("keeps 1-of-N picks and leaves the rarity out when the entry names none", () => {
    const built = rewardsOf([lootEntry("SW.Quest.Loot.Armour.PhantomSet")], CTX, "CA04 first");
    expect(built.rewards).toEqual([{ kind: "items", source: "quest:QuestArmourPhantomSet", items: ["armor/phantom-boots", "armor/phantom-helmet"], picks: { count: 1, of: 2 } }]);
  });
  it("turns the area-drop row into random items from the named area", () => {
    const built = rewardsOf([lootEntry("SW.Quest.Loot.AreaDropModifier", "SW.Area.Forest.A1", "SW.RarityChance.Quest.Special")], CTX, "CA02 every");
    expect(built.rewards).toEqual([{ kind: "areaDrop", area: { name: FOREST }, count: 1, rarity: "special" }]);
  });
  it("reports an area drop whose area has no name, and one with no area tag", () => {
    expect(rewardsOf([lootEntry("SW.Area.Nowhere", "SW.Quest.Loot.AreaDropModifier")], CTX, "X every").issues).toEqual([
      { type: "quest-area-unnamed", detail: "X every: SW.Area.Nowhere" },
    ]);
    expect(rewardsOf([lootEntry("SW.Quest.Loot.AreaDropModifier")], CTX, "X every").issues[0]?.detail).toBe("X every: (no area tag)");
  });
  it("reports an area-drop row that drops nothing", () => {
    const ctx = { ...CTX, rowsByTag: rowsByTag([lootRow("QuestAreaLootDropModifier", "SW.Quest.Loot.AreaDropModifier")]) };
    expect(rewardsOf([lootEntry("SW.Quest.Loot.AreaDropModifier", "SW.Area.Forest.A1")], ctx, "X every").issues).toEqual([
      { type: "quest-reward-empty", detail: "X every: QuestAreaLootDropModifier" },
    ]);
  });
  it("reports an entry that names no row, and a row with no items", () => {
    const built = rewardsOf([lootEntry(), lootEntry("SW.Quest.Loot.Melee.Nothing"), lootEntry("SW.Quest.Loot.Talisman.Empty")], CTX, "Q every");
    expect(built.rewards).toEqual([]);
    expect(built.issues).toEqual([
      { type: "quest-reward-unmatched", detail: "Q every: (no tags)" },
      { type: "quest-reward-unmatched", detail: "Q every: SW.Quest.Loot.Melee.Nothing" },
      { type: "quest-reward-empty", detail: "Q every: QuestTalismanEmpty" },
    ]);
  });
  it("gives one reward per row an entry names, and shows a repeated reward once", () => {
    const entry = lootEntry("SW.Area.Forest.A1", "SW.Quest.Loot.AreaDropModifier", "SW.Quest.Loot.Melee.Axe");
    const built = rewardsOf([entry, entry], CTX, "CA08_B every");
    expect(built.rewards.map((reward) => reward.kind)).toEqual(["areaDrop", "items"]);
  });
});

describe("rewardRowNames", () => {
  it("names every row of both lists once", () => {
    const quest = rawQuest({
      id: "CA02",
      first: [lootEntry("SW.Quest.Loot.Melee.Axe")],
      every: [lootEntry("SW.Quest.Loot.Melee.Axe"), lootEntry("SW.Quest.Loot.AreaDropModifier", "SW.Area.Forest.A1"), lootEntry("SW.Unknown")],
    });
    expect(rewardRowNames(quest, ROWS)).toEqual(["QuestMeleeAxe", "QuestAreaLootDropModifier"]);
  });
});

describe("emeraldsOf", () => {
  it("reads the emerald slot of the size row", () => {
    expect(emeraldsOf("SW.QuestSize.Medium", ROWS)).toEqual({ guaranteed: 8, rolls: 8, chancePerRoll: 0.25 });
  });
  it("is null for a size with no row or no emerald slot", () => {
    expect(emeraldsOf("SW.QuestSize.Huge", ROWS)).toBeNull();
    expect(emeraldsOf("SW.Quest.Loot.Melee.Axe", ROWS)).toBeNull();
  });
});
