import { describe, expect, it } from "vitest";
import ko from "../../../src/i18n/ko.json";
import { lookupWith, resolveUiValue, t } from "../../../src/lib/ui-strings";

describe("resolveUiValue", () => {
  const all = { own: "file", game: "game", english: "english" };

  it("prefers the language file, then the game, for hand-written languages", () => {
    expect(resolveUiValue("k", true, all)).toBe("file");
    expect(resolveUiValue("k", true, { game: "game", english: "english" })).toBe("game");
  });

  it("prefers the game, then the language file, for other languages", () => {
    expect(resolveUiValue("k", false, all)).toBe("game");
    expect(resolveUiValue("k", false, { own: "file", english: "english" })).toBe("file");
  });

  it("falls back to English, then to the key, without throwing", () => {
    expect(resolveUiValue("k", true, { english: "english" })).toBe("english");
    expect(resolveUiValue("k", false, { english: { one: "a", other: "b" } })).toEqual({ one: "a", other: "b" });
    expect(resolveUiValue("k", false, {})).toBe("k");
  });
});

describe("label colons", () => {
  it("uses an ASCII colon and space in English and a full-width colon in CJK", () => {
    expect(t("en", "labelColon")).toBe(": ");
    expect(t("zh", "labelColon")).toBe("：");
    expect(t("ja", "labelColon")).toBe("：");
  });
});

describe("lookupWith", () => {
  it("falls through to the language file when the game lacks that language", () => {
    const game = { categoryMelee: { en: "Melee", zh: "近戰" } };
    expect(lookupWith(game, "ko", "categoryMelee")).toBe(ko.categoryMelee);
    expect(ko.categoryMelee).not.toBe("Melee");
  });

  it("prefers the game's wording when it has the language", () => {
    expect(lookupWith({ categoryMelee: { en: "Melee", ko: "근접 무기 (game)" } }, "ko", "categoryMelee")).toBe("근접 무기 (game)");
  });
});
