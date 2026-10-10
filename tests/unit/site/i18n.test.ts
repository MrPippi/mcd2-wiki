import { describe, expect, it } from "vitest";
import { CATEGORIES } from "../../../scripts/extract/config";
import { MARKER_KINDS } from "../../../scripts/extract/map-schema";
import { LANGS } from "../../../scripts/extract/langs";
import { GRID_CATEGORIES, NAV_GROUPS, TABLE_CATEGORIES, categoryLabel, markerLabel, otherLang, pieceLabel, t } from "../../../src/lib/i18n";
import { machineKeys, tCount } from "../../../src/lib/ui-strings";
import en from "../../../src/i18n/en.json";
import zh from "../../../src/i18n/zh.json";

const FILES = { zh, en } as const;
const keysOf = (file: Record<string, unknown>): string[] => Object.keys(file).filter((key) => key !== "_machine").sort();

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
      expect(categoryLabel(category, "zh")).not.toBe("");
      expect(categoryLabel(category, "en")).not.toBe("");
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

  it("defines every UI string in every language file", () => {
    for (const lang of LANGS) expect(keysOf(FILES[lang])).toEqual(keysOf(zh));
    for (const key of ["searchPlaceholder", "view", "itemDetails", "rarity", "setPieces", "placeholderLabel", "swingN", "unitBlocks"]) expect(keysOf(zh)).toContain(key);
  });

  it("lists only existing keys as machine translated", () => {
    for (const lang of LANGS) for (const key of machineKeys(lang)) expect(keysOf(zh)).toContain(key);
  });

  it("picks the plural form of a unit", () => {
    expect(tCount("en", "unitBlocks", 1)).toBe("1 block");
    expect(tCount("en", "unitBlocks", 3)).toBe("3 blocks");
    expect(tCount("zh", "unitBlocks", 3)).toBe("3 格");
  });

  it("labels the armor pieces", () => {
    expect(pieceLabel("helmet", "zh")).toBe("頭盔");
    expect(pieceLabel("boots", "en")).toBe("Boots");
  });

  it("labels every map marker kind in both languages", () => {
    for (const kind of MARKER_KINDS) {
      expect(markerLabel(kind, "zh")).not.toBe("");
      expect(markerLabel(kind, "en")).not.toBe("");
    }
  });
});
