import { describe, expect, it } from "vitest";
import type { Quest } from "../../../scripts/extract/quest-schema";
import { countMark, listParts, questSections, rewardQuestSlugs, splitItemKey, templateParts } from "../../../src/lib/quest-view";
import { localizedFrom } from "../../../src/lib/lang";

const area = (id: string) => ({ areaId: id, name: localizedFrom(() => id) });
const quest = (slug: string, section: Quest["section"], region: string | null = null): Quest => ({
  slug, id: slug, section, type: section === "core" ? "core" : "side", size: "small", replayable: false,
  title: { text: localizedFrom(() => slug), untranslated: [] }, description: null, completed: null,
  region: region === null ? null : area(region), prerequisites: [], unlocks: [], objectives: [],
  rewards: { first: [], every: [], emeralds: null }, mobs: [],
});

describe("questSections", () => {
  it("orders the sections, leaves empty ones out and groups side quests by region in data order", () => {
    const sections = questSections([
      quest("r1", "bossReplay"), quest("c1", "core", "A"), quest("s1", "side", "B"), quest("s2", "side", "A"), quest("s3", "side", "B"), quest("c2", "core"),
    ]);
    expect(sections.map((section) => [section.section, section.count])).toEqual([["core", 2], ["side", 3], ["bossReplay", 1]]);
    const side = sections[1];
    expect(side?.groups.map((group) => [group.region?.areaId, group.quests.map((one) => one.slug)])).toEqual([["B", ["s1", "s3"]], ["A", ["s2"]]]);
    expect(sections[0]?.groups).toHaveLength(1);
    expect(sections[0]?.groups[0]?.region).toBeNull();
  });
  it("puts side quests without a region in their own group", () => {
    const side = questSections([quest("s1", "side"), quest("s2", "side", "A")])[0];
    expect(side?.groups.map((group) => group.region?.areaId ?? null)).toEqual([null, "A"]);
  });
});

describe("rewardQuestSlugs", () => {
  it("gives the quests of a known source and nothing otherwise", () => {
    const data = { rewardSources: { "quest:QuestMeleeAxe": ["ca02"] } };
    expect(rewardQuestSlugs(data, "quest:QuestMeleeAxe")).toEqual(["ca02"]);
    expect(rewardQuestSlugs(data, "quest:QuestTalismanRangedBoost")).toEqual([]);
    expect(rewardQuestSlugs(data, "constructor")).toEqual([]);
  });
});

describe("splitItemKey", () => {
  it("splits category and slug", () => {
    expect(splitItemKey("melee/axe")).toEqual({ category: "melee", slug: "axe" });
    expect(splitItemKey("melee")).toBeUndefined();
    expect(splitItemKey("a/b/c")).toBeUndefined();
    expect(splitItemKey("/axe")).toBeUndefined();
  });
});

describe("templateParts", () => {
  it("cuts the text around the slot", () => {
    expect(templateParts("Reward of {quest}", "quest")).toEqual([{ kind: "text", text: "Reward of " }, { kind: "slot" }]);
    expect(templateParts("{quest}の報酬", "quest")).toEqual([{ kind: "slot" }, { kind: "text", text: "の報酬" }]);
    expect(templateParts("「{quest}」", "quest")).toEqual([{ kind: "text", text: "「" }, { kind: "slot" }, { kind: "text", text: "」" }]);
  });
  it("puts the slot last when the template has none", () => {
    expect(templateParts("Reward:", "quest")).toEqual([{ kind: "text", text: "Reward:" }, { kind: "slot" }]);
  });
});

describe("listParts", () => {
  it("is the item alone for one item", () => {
    expect(listParts("en", 1)).toEqual([{ kind: "item", index: 0 }]);
  });
  it("joins items the way the language lists them", () => {
    const parts = listParts("en", 2);
    expect(parts.filter((part) => part.kind === "item")).toEqual([{ kind: "item", index: 0 }, { kind: "item", index: 1 }]);
    expect(parts.map((part) => (part.kind === "text" ? part.text : `#${part.index}`)).join("")).toMatch(/^#0.+#1$/);
  });
});

describe("countMark", () => {
  it("marks counts above one", () => {
    expect(countMark(3)).toBe("×3");
    expect(countMark(1)).toBe("");
  });
});
