import { describe, expect, it } from "vitest";
import {
  achievementAnchor,
  achievementData,
  achievementsByRate,
  conditionSentence,
  formatPercent,
  formatRetrieved,
  untranslatedMarkers,
} from "../../../src/lib/achievements";
import { SITE_MENU, isMenuPage } from "../../../src/lib/site-menu";
import type { Achievement } from "../../../scripts/extract/achievement-schema";
import { loc } from "../../helpers/localized";

const achievement = (id: string, globalPercent: number): Achievement => ({
  id,
  slug: id.toLowerCase(),
  globalPercent,
  hidden: false,
  name: loc({ en: id }),
});

describe("achievement data", () => {
  it("loads all 32 Steam achievements with text in every language", () => {
    expect(achievementData.achievements).toHaveLength(32);
    expect(achievementData.achievements.filter((item) => item.hidden)).toHaveLength(19);
    expect(achievementData.achievements.every((item) => item.icon?.endsWith(".webp"))).toBe(true);
  });

  it("orders achievements by global unlock rate, highest first, without changing the input", () => {
    const input = [achievement("B", 10), achievement("A", 90.5), achievement("C", 10)];
    expect(achievementsByRate(input).map((item) => item.id)).toEqual(["A", "B", "C"]);
    expect(input.map((item) => item.id)).toEqual(["B", "A", "C"]);
  });

  it("formats the unlock rate the way each language writes percentages", () => {
    expect(formatPercent(91.9, "zh")).toBe("91.9%");
    expect(formatPercent(91.9, "en")).toBe("91.9%");
    expect(formatPercent(5, "en")).toBe("5.0%");
    expect(formatPercent(91.9, "de")).toMatch(/^91,9\s%$/);
    expect(formatPercent(91.9, "tr")).toBe("%91,9");
  });

  it("formats the retrieval date in the page language and keeps unreadable dates as they are", () => {
    expect(formatRetrieved("2026-10-11", "en")).toBe("Oct 11, 2026");
    expect(formatRetrieved("2026-10-11", "zh")).toBe("2026年10月11日");
    expect(formatRetrieved("someday", "en")).toBe("someday");
  });
});

describe("hidden achievement conditions", () => {
  it("names every hidden achievement's unlock condition", () => {
    const hidden = achievementData.achievements.filter((item) => item.hidden);
    expect(hidden.every((item) => item.condition !== undefined)).toBe(true);
    expect(achievementData.achievements.filter((item) => !item.hidden).every((item) => item.condition === undefined)).toBe(true);
  });

  it("writes the condition as a sentence in the page language", () => {
    const quest = { type: "quest" as const, name: loc({ en: "Escape from Squid Coast", zh: "逃離烏賊海岸" }) };
    expect(conditionSentence(quest, "zh")).toBe("完成任務「逃離烏賊海岸」");
    expect(conditionSentence(quest, "en")).toBe("Complete the quest “Escape from Squid Coast”");
    expect(conditionSentence({ ...quest, type: "task", name: loc({ en: "Enter the rift", zh: "進入裂隙" }) }, "zh")).toBe("完成任務目標「進入裂隙」");
    expect(conditionSentence({ ...quest, type: "boss", name: loc({ en: "Monarch", zh: "君主" }) }, "zh")).toBe("擊敗「君主」");
    expect(conditionSentence({ ...quest, type: "boss", name: loc({ en: "Monarch", ja: "モナーク" }) }, "ja")).toContain("モナーク");
  });
});

describe("untranslated markers", () => {
  const fellBack = (id: string, untranslated?: Achievement["untranslated"]): Achievement => ({ ...achievement(id, 1), ...(untranslated ? { untranslated } : {}) });

  it("marks the page once when every achievement shows English", () => {
    const list = [fellBack("A", ["ja", "ko"]), fellBack("B", ["ja"])];
    expect(untranslatedMarkers(list, "ja")).toEqual({ page: true, cards: new Set() });
  });

  it("marks only the cards that fall back when the others do not", () => {
    const list = [fellBack("A", ["zh", "ja"]), fellBack("B", ["ja"])];
    expect(untranslatedMarkers(list, "zh")).toEqual({ page: false, cards: new Set(["A"]) });
  });

  it("marks nothing when the language has its own text", () => {
    expect(untranslatedMarkers([fellBack("A", ["ja"]), fellBack("B")], "en")).toEqual({ page: false, cards: new Set() });
    expect(untranslatedMarkers([], "ja")).toEqual({ page: false, cards: new Set() });
  });
});

describe("achievementAnchor", () => {
  it("prefixes the slug so card anchors cannot clash with other ids on the page", () => {
    expect(achievementAnchor("equip-a-unique-item")).toBe("ach-equip-a-unique-item");
  });
});

describe("site menu", () => {
  it("lists the map, the achievements, the bestiary, the Soul Storms and the build planner", () => {
    expect(SITE_MENU.map((item) => item.segment)).toEqual(["map", "achievements", "mobs", "soul-storm", "build", "compare", "quests", "locations", "bosses"]);
  });

  it("knows which menu page is open, with or without a base path", () => {
    expect(isMenuPage("/zh/map/", "/", "map")).toBe(true);
    expect(isMenuPage("/ja/achievements/", "/", "achievements")).toBe(true);
    expect(isMenuPage("/wiki/ja/achievements/", "/wiki/", "achievements")).toBe(true);
    expect(isMenuPage("/wiki/ja/achievements/", "/wiki", "achievements")).toBe(true);
    expect(isMenuPage("/zh/map/", "/", "achievements")).toBe(false);
    expect(isMenuPage("/zh/melee/map/", "/", "map")).toBe(false);
    expect(isMenuPage("/zh/", "/", "map")).toBe(false);
  });
});
