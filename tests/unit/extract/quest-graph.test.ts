import { describe, expect, it } from "vitest";
import { byProgress, chainOrder, progressOf, questSlug, sectionOf, sizeOf, unlocksOf } from "../../../scripts/extract/quest-graph";

describe("questSlug", () => {
  it("kebab-cases the quest id", () => {
    expect(questSlug("CA02_B")).toBe("ca02-b");
    expect(questSlug("FOa1_S08_A")).toBe("foa1-s08-a");
    expect(questSlug("CA10_BR_B")).toBe("ca10-br-b");
    expect(questSlug("_X__Y_")).toBe("x-y");
  });
});

describe("sectionOf", () => {
  it("puts core quests first, then replays, Echo Golem quests and side quests", () => {
    expect(sectionOf({ id: "CA02", quest_type: "CoreQuest" })).toBe("core");
    expect(sectionOf({ id: "CA02_B_BR", quest_type: "SideQuest" })).toBe("bossReplay");
    expect(sectionOf({ id: "CA10_BR", quest_type: "SideQuest" })).toBe("bossReplay");
    expect(sectionOf({ id: "CT_S01_A", quest_type: "SideQuest" })).toBe("echoGolem");
    expect(sectionOf({ id: "FOa1_S08_A", quest_type: "SideQuest" })).toBe("side");
    expect(sectionOf({ id: "CA02_BRIDGE", quest_type: "SideQuest" })).toBe("side");
  });
});

describe("sizeOf", () => {
  it("reads the quest size tag", () => {
    expect(sizeOf("SW.QuestSize.Small")).toBe("small");
    expect(sizeOf("SW.QuestSize.ExtraLarge")).toBe("extraLarge");
    expect(sizeOf("sw.questsize.medium")).toBe("medium");
    expect(sizeOf("SW.QuestSize.Huge")).toBeUndefined();
  });
});

describe("chainOrder", () => {
  it("orders by prerequisites, input order breaking ties", () => {
    const quests = [
      { id: "CA02", prerequisites: ["CA01_B"] },
      { id: "CA00", prerequisites: [] },
      { id: "CA01_B", prerequisites: ["CA01"] },
      { id: "CA01", prerequisites: ["CA00"] },
      { id: "CA02_C", prerequisites: ["CA02"] },
    ];
    expect(chainOrder(quests)).toEqual(["CA00", "CA01", "CA01_B", "CA02", "CA02_C"]);
  });
  it("ignores prerequisites outside the list and appends a cycle in input order", () => {
    const quests = [{ id: "B", prerequisites: ["C"] }, { id: "A", prerequisites: ["OUT"] }, { id: "C", prerequisites: ["B"] }];
    expect(chainOrder(quests)).toEqual(["A", "B", "C"]);
  });
});

describe("unlocksOf", () => {
  it("reverses prerequisites", () => {
    const unlocks = unlocksOf([{ id: "A", prerequisites: [] }, { id: "B", prerequisites: ["A"] }, { id: "C", prerequisites: ["A", "B"] }]);
    expect(unlocks.get("A")).toEqual(["B", "C"]);
    expect(unlocks.get("B")).toEqual(["C"]);
    expect(unlocks.get("C")).toBeUndefined();
  });
});

describe("progressOf / byProgress", () => {
  const quests = [
    { id: "CA00", prerequisites: [] },
    { id: "CA01", prerequisites: ["CA00"] },
    { id: "S1", prerequisites: ["CA01"] },
    { id: "S2", prerequisites: ["S1"] },
    { id: "S0", prerequisites: ["CA00"] },
    { id: "LOOP", prerequisites: ["LOOP"] },
    { id: "LOST", prerequisites: [] },
  ];
  const progress = progressOf(quests, ["CA00", "CA01"]);

  it("anchors a side quest on the core quest it hangs off", () => {
    expect(progress.get("S2")).toEqual({ anchor: 1, hops: 2 });
    expect(progress.get("S0")).toEqual({ anchor: 0, hops: 1 });
    expect(progress.get("CA01")).toEqual({ anchor: 1, hops: 0 });
  });
  it("puts quests with no way back to the core chain after it", () => {
    expect(progress.get("LOOP")?.anchor).toBe(2);
    expect(progress.get("LOST")).toEqual({ anchor: 2, hops: 0 });
  });
  it("sorts by anchor, hops, then id", () => {
    expect(["LOST", "S2", "S1", "S0", "LOOP", "CA00", "UNKNOWN"].sort(byProgress(progress))).toEqual(["CA00", "S0", "S1", "S2", "LOST", "LOOP", "UNKNOWN"]);
  });
});
