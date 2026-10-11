import { describe, expect, it } from "vitest";
import { achievementData, achievementsByRate, formatPercent, formatRetrieved } from "../../../src/lib/achievements";
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

describe("site menu", () => {
  it("lists the map and the achievements", () => {
    expect(SITE_MENU.map((item) => item.segment)).toEqual(["map", "achievements"]);
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
