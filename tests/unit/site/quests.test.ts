import { describe, expect, it } from "vitest";
import { QuestDataSchema } from "../../../scripts/extract/quest-schema";
import rawQuests from "../../../src/data/quests.json";
import rawSources from "../../../src/data/loot-sources.json";
import { findMob } from "../../../src/lib/mobs";
import { questSections } from "../../../src/lib/quest-view";
import { findQuest, questData, questDescription, questHref, rewardEntries, rewardQuests } from "../../../src/lib/quests";
import { SITE_MENU } from "../../../src/lib/site-menu";

describe("quests.json", () => {
  it("validates against the schema", () => {
    expect(QuestDataSchema.safeParse(rawQuests).success).toBe(true);
  });

  it("has 15 core quests, 16 side quests, 4 Echo Golem quests and 7 boss replays", () => {
    expect(questSections(questData.quests).map((section) => [section.section, section.count])).toEqual([
      ["core", 15], ["side", 16], ["echoGolem", 4], ["bossReplay", 7],
    ]);
  });

  it("runs the core chain in prerequisite order", () => {
    const core = questData.quests.filter((quest) => quest.section === "core");
    expect(core.map((quest) => quest.id)).toEqual(["CA00", "CA01", "CA01_B", "CA02", "CA02_C", "CA02_B", "CA03", "CA04", "CA07", "CA05", "CA06", "CA08", "CA08_B", "CA09", "CA10"]);
    for (const [i, quest] of core.entries()) if (i > 0) expect(quest.prerequisites, quest.id).toContain(core[i - 1]?.slug);
  });

  it("leaves out the dev rows", () => {
    for (const id of ["CA04_BR", "TOa1_S01_A"]) expect(questData.quests.some((quest) => quest.id === id), id).toBe(false);
  });

  it("links only to quests, mobs and items that exist", () => {
    for (const quest of questData.quests) {
      for (const slug of [...quest.prerequisites, ...quest.unlocks]) expect(findQuest(slug), `${quest.slug} → ${slug}`).toBeDefined();
      for (const slug of quest.mobs) expect(findMob(slug), `${quest.slug} mob ${slug}`).toBeDefined();
      for (const reward of [...quest.rewards.first, ...quest.rewards.every]) {
        if (reward.kind === "items") expect(rewardEntries(reward.items).length, `${quest.slug} ${reward.source}`).toBe(reward.items.length);
      }
    }
    for (const [source, slugs] of Object.entries(questData.rewardSources)) {
      expect(Object.hasOwn(rawSources.sources, source), source).toBe(true);
      for (const slug of slugs) expect(findQuest(slug), `${source} → ${slug}`).toBeDefined();
    }
  });

  it("names the quest that gives an item-page source, and none where that is not exact", () => {
    expect(rewardQuests("quest:QuestMeleeAxe").map((quest) => quest.id)).toEqual(["CA02"]);
    expect(rewardQuests("quest:QuestTalismanRangedBoost")).toEqual([]);   // also given by the left-out CA04_BR
    expect(rewardQuests("quest:QuestMeleeSword")).toEqual([]);   // no quest gives it
  });

  it("gives every quest an emerald bundle and a known size", () => {
    for (const quest of questData.quests) {
      expect(quest.rewards.emeralds, quest.slug).not.toBeNull();
      expect(quest.size, quest.slug).not.toBeNull();
    }
  });

  it("keeps steps that come back later in a quest (CA02_B ends by speaking to the Forager)", () => {
    const objectives = findQuest("ca02-b")?.objectives.map((objective) => objective.text.en) ?? [];
    expect(objectives.at(-1)).toBe("Speak to the Forager");
  });

  it("counts the two area-drop entries of a boss replay's first completion as two items", () => {
    for (const slug of ["ca09-br", "ca10-br"]) {
      const drops = findQuest(slug)?.rewards.first.filter((reward) => reward.kind === "areaDrop") ?? [];
      expect(drops.map((reward) => (reward.kind === "areaDrop" ? reward.count : 0)), slug).toEqual([2]);
    }
  });

  it("finds the Soul Corrupted Witch through the witch arena's spawn-definition override", () => {
    for (const slug of ["ca02-b", "ca02-b-br"]) expect(findQuest(slug)?.mobs, slug).toContain("soul-corrupted-witch");
  });

  it("shows English where a language's description is its own completed text (PLa1_S04_A zh)", () => {
    const description = findQuest("pla1-s04-a")?.description;
    expect(description?.untranslated).toContain("zh");
    expect(description?.html.zh).toBe(description?.html.en);
  });

  it("describes a quest page and links it", () => {
    const quest = findQuest("ca02");
    if (!quest) throw new Error("no ca02");
    expect(questDescription(quest, "en")).toBe("The Silence in Little Howl · Core Quest · Howling Woods · Quests · Minecraft Dungeons II");
    expect(questHref("zh", "ca02")).toBe("/zh/quests/ca02/");
  });

  it("puts the quest list in the menu after the weapon comparison", () => {
    const at = SITE_MENU.findIndex((item) => item.segment === "quests");
    expect(SITE_MENU[at - 1]).toEqual({ key: "weaponCompare", segment: "compare" });
    expect(SITE_MENU[at]).toEqual({ key: "quests", segment: "quests" });
  });
});
