import { describe, expect, it } from "vitest";
import { ALL_LANGS, LANG_META } from "../../../shared/config";
import { compareLang, foldForSearch, langMenuLabel, lowerFor, mapLocalized, pick, searchFold, searchNames } from "../../../shared/lang";
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

describe("search folding", () => {
  it("folds Turkish dotted and dotless I so a Turkish query meets Turkish names", () => {
    const name = searchFold("İki Elli Kılıç", "tr");
    expect(name.includes(searchFold("İki", "tr"))).toBe(true);
    expect(name.includes(searchFold("iki", "tr"))).toBe(true);
    expect(searchFold("Işıltılı Bıçak", "tr").includes(searchFold("Işıltılı", "tr"))).toBe(true);
    expect(searchFold("Işıltılı Bıçak", "tr").includes(searchFold("ışıltılı", "tr"))).toBe(true);
  });

  it("finds an English compare name on a Turkish page", () => {
    const haystack = searchNames(loc({ zh: "鐵拳", en: "Fist of Iron", tr: "Demir Yumruk" }), "tr");
    expect(haystack.includes(searchFold("iron", "tr"))).toBe(true);
    expect(haystack.includes(searchFold("IRON", "tr"))).toBe(true);
    expect(haystack.includes(searchFold("demir", "tr"))).toBe(true);
  });

  it("lists the page language then its comparison language, each folded", () => {
    expect(searchNames(loc({ zh: "劍", en: "Sword" }), "en")).toBe("sword 劍");
    expect(searchNames(loc({ zh: "劍", en: "Sword", ru: "Меч" }), "ru")).toBe("меч sword");
  });

  it("folds by a locale tag for browser code that only knows the page's html lang", () => {
    expect(foldForSearch("İki", "tr")).toBe("iki");
    expect(foldForSearch("IŞIK", "tr")).toBe("işik");
    expect(foldForSearch("İki", "en")).toBe("iki");
    expect(foldForSearch("Straße", "de")).toBe("straße");
  });
});

describe("langMenuLabel", () => {
  it("names the menu, the current language and the code shown on narrow screens", () => {
    expect(langMenuLabel("ja", "言語")).toBe("言語: 日本語 (JA)");
    expect(langMenuLabel("zh-hans", "语言")).toBe("语言: 简体中文 (ZH-HANS)");
  });
});
