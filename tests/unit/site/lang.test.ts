import { describe, expect, it } from "vitest";
import { ALL_LANGS, LANG_META } from "../../../scripts/extract/config";
import { compareLang, lowerFor, mapLocalized, pick } from "../../../src/lib/lang";
import { loc } from "../../helpers/localized";

describe("language registry", () => {
  it("lists the 16 site languages in menu order with their metadata", () => {
    expect(ALL_LANGS).toEqual(["zh", "zh-hans", "en", "ja", "ko", "de", "fr", "es", "it", "pt", "ru", "pl", "nl", "sv", "tr", "uk"]);
    expect(LANG_META.zh).toEqual({ culture: "zh-Hant", htmlLang: "zh-TW", ogLocale: "zh_TW", nativeName: "繁體中文", fontScript: "tc" });
    expect(LANG_META["zh-hans"].culture).toBe("zh-Hans");
    expect(LANG_META.pt).toMatchObject({ culture: "pt-BR", htmlLang: "pt-BR" });
    expect(LANG_META.ru.fontScript).toBe("cyrillic");
    for (const lang of ALL_LANGS) expect(LANG_META[lang].nativeName).not.toBe("");
  });
});

describe("language helpers", () => {
  it("compares English with Traditional Chinese and every other language with English", () => {
    expect(compareLang("en")).toBe("zh");
    expect(compareLang("zh")).toBe("en");
    expect(compareLang("ja")).toBe("en");
    expect(compareLang("zh-hans")).toBe("en");
  });

  it("picks and maps localized text without changing the input", () => {
    const value = loc({ zh: "劍", en: "Sword", ja: "剣" });
    expect(pick(value, "zh")).toBe("劍");
    expect(pick(value, "ja")).toBe("剣");
    const mapped = mapLocalized(value, (text, lang) => `${lang}:${text}`);
    expect(mapped).toMatchObject({ zh: "zh:劍", en: "en:Sword", ja: "ja:剣", de: "de:Sword" });
    expect(Object.keys(mapped)).toEqual([...ALL_LANGS]);
    expect(value).toEqual(loc({ zh: "劍", en: "Sword", ja: "剣" }));
  });

  it("lowercases with the language's own rules", () => {
    expect(lowerFor("SWORD", "en")).toBe("sword");
    expect(lowerFor("İSTANBUL", "tr")).toBe("istanbul");
    expect(lowerFor("I", "tr")).toBe("ı");
    expect(lowerFor("I", "en")).toBe("i");
  });
});
