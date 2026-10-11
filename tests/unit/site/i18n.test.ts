import { describe, expect, it } from "vitest";
import { CATEGORIES } from "../../../scripts/extract/config";
import { MARKER_KINDS } from "../../../scripts/extract/map-schema";
import { LANGS } from "../../../scripts/extract/langs";
import { GRID_CATEGORIES, NAV_GROUPS, TABLE_CATEGORIES, categoryLabel, lootSlotLabel, markerLabel, mobKindLabel, pieceLabel, statLabel, t } from "../../../src/lib/i18n";
import { LOOT_SLOT_KEYS, STAT_KEYS } from "../../../scripts/extract/mob-schema";
import { machineKeys, tCount } from "../../../src/lib/ui-strings";
import { UI_DICTS } from "../../../src/lib/ui-dicts";
import zh from "../../../src/i18n/zh.json";

const keysOf = (file: Record<string, unknown>): string[] => Object.keys(file).filter((key) => key !== "_machine" && key !== "_english").sort();

describe("i18n", () => {
  it("translates UI keys", () => {
    expect(t("zh", "languageMenu")).toBe("語言");
    expect(t("en", "languageMenu")).toBe("Language");
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
    for (const lang of LANGS) expect(keysOf(UI_DICTS[lang].values)).toEqual(keysOf(zh));
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
  it("labels stats, loot slots and mob kinds in the page language", () => {
    expect(statLabel("health", "zh")).toBe("生命值");
    expect(lootSlotLabel("springStone", "en")).toBe("Echo Shards");
    expect(mobKindLabel("miniboss", "zh")).toBe("小頭目");
  });

  it("labels every stat and loot slot in every language", () => {
    for (const lang of LANGS) {
      for (const key of STAT_KEYS) expect(statLabel(key, lang), `${lang}.${key}`).not.toBe("");
      for (const slot of LOOT_SLOT_KEYS) expect(lootSlotLabel(slot, lang), `${lang}.${slot}`).not.toBe("");
    }
  });
});
