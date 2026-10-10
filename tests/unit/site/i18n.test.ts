import { describe, expect, it } from "vitest";
import { CATEGORIES } from "../../../scripts/extract/config";
import { CATEGORY_LABEL, GRID_CATEGORIES, NAV_GROUPS, TABLE_CATEGORIES, otherLang, t } from "../../../src/lib/i18n";

describe("i18n", () => {
  it("swaps languages", () => {
    expect(otherLang("zh")).toBe("en");
    expect(otherLang("en")).toBe("zh");
  });

  it("translates UI keys", () => {
    expect(t("zh", "switchLang")).toBe("English");
    expect(t("en", "switchLang")).toBe("繁體中文");
  });

  it("labels every category in both languages", () => {
    for (const category of CATEGORIES) {
      expect(CATEGORY_LABEL[category].zh).not.toBe("");
      expect(CATEGORY_LABEL[category].en).not.toBe("");
    }
  });

  it("groups talismans with equipment", () => {
    expect(NAV_GROUPS.find((group) => group.key === "equipment")?.categories).toContain("talisman");
  });

  it("does not publish statuses or cosmetics for now", () => {
    const published = [...NAV_GROUPS.flatMap((group) => group.categories), ...GRID_CATEGORIES, ...TABLE_CATEGORIES];
    for (const hidden of ["status", "cape", "pet", "skin"]) expect(published).not.toContain(hidden);
  });

  it("navigates to every published category; books merge into enchantments", () => {
    const hidden = new Set(["enchantment-book", "status", "cape", "pet", "skin"]);
    const shown = CATEGORIES.filter((category) => !hidden.has(category)).sort();
    expect(NAV_GROUPS.flatMap((group) => group.categories).sort()).toEqual(shown);
    expect([...GRID_CATEGORIES, ...TABLE_CATEGORIES, "armor"].sort()).toEqual(shown);
  });

  it("defines every UI string in both languages", async () => {
    const zh = Object.keys((await import("../../../src/lib/i18n")).UI_STRINGS.zh).sort();
    const en = Object.keys((await import("../../../src/lib/i18n")).UI_STRINGS.en).sort();
    expect(en).toEqual(zh);
    for (const key of ["searchPlaceholder", "view", "itemDetails", "rarity", "setPieces"]) expect(zh).toContain(key);
  });
});
