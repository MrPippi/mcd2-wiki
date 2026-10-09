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

  it("puts every category in the navigation and every non-armor category in a page group", () => {
    expect(NAV_GROUPS.flatMap((group) => group.categories).sort()).toEqual([...CATEGORIES].sort());
    expect([...GRID_CATEGORIES, ...TABLE_CATEGORIES, "armor"].sort()).toEqual([...CATEGORIES].sort());
  });
});
