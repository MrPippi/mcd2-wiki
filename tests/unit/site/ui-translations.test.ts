import { describe, expect, it } from "vitest";
import gameKeys from "../../../scripts/extract/ui-game-keys.json";
import { LANGS, LANG_META, type Lang } from "../../../scripts/extract/langs";
import { UI_DICTS, plainText } from "../../../src/lib/ui-dicts";

const HAND_WRITTEN: readonly Lang[] = ["zh", "en"];
const TRANSLATED = LANGS.filter((lang) => !HAND_WRITTEN.includes(lang));
const GAME_KEYS = new Set(Object.keys(gameKeys));
/** Keys whose value is fixed rather than translated: the site title set by the spec. */
const FIXED_KEYS = new Set(["siteTitle", "rootRedirectTitle"]);
const COMPARE_KEYS = ["tagline", "source", "compare"] as const;

describe("UI translations", () => {
  it("gives every plural unit each form its language needs", () => {
    for (const lang of LANGS) {
      const needed = new Intl.PluralRules(LANG_META[lang].htmlLang).resolvedOptions().pluralCategories;
      for (const [key, value] of Object.entries(UI_DICTS[lang].values)) {
        if (typeof value === "string") continue;
        for (const category of needed) expect(value[category as keyof typeof value], `${lang}.${key}.${category}`).toBeTypeOf("string");
      }
    }
  });

  it("keeps the count placeholder in every unit form", () => {
    for (const lang of LANGS) {
      for (const key of ["unitSeconds", "unitBlocks", "swingN"]) {
        const value = UI_DICTS[lang].values[key];
        const forms = value === undefined ? [] : typeof value === "string" ? [value] : Object.values(value);
        for (const form of forms) expect(form, `${lang}.${key}`).toContain("{n}");
      }
    }
  });

  it("wraps the placeholder label in braces", () => {
    for (const lang of LANGS) expect(plainText(UI_DICTS[lang].values.placeholderLabel ?? ""), lang).toMatch(/^\{[^{}]+\}$/);
  });

  it("marks no keys as machine translated in the hand-written languages", () => {
    for (const lang of HAND_WRITTEN) expect(UI_DICTS[lang].machine, lang).toEqual([]);
  });

  it("marks exactly the translated keys as machine translated in the other languages", () => {
    for (const lang of TRANSLATED) {
      const expected = Object.keys(UI_DICTS[lang].values).filter((key) => !GAME_KEYS.has(key) && !FIXED_KEYS.has(key)).sort();
      expect([...UI_DICTS[lang].machine].sort(), lang).toEqual(expected);
    }
  });

  it("translates the files instead of copying English", () => {
    for (const lang of TRANSLATED) {
      for (const key of ["tagline", "notFoundBody", "obtainedFromBook", "disclaimer", "mapIntro"]) {
        expect(UI_DICTS[lang].values[key], `${lang}.${key}`).not.toEqual(UI_DICTS.en.values[key]);
      }
    }
  });

  it("names the site per language", () => {
    expect(UI_DICTS.zh.values.siteTitle).toBe("Minecraft Dungeons II 中文 Wiki");
    expect(UI_DICTS["zh-hans"].values.siteTitle).toBe("Minecraft Dungeons II 中文 Wiki（简体）");
    for (const lang of LANGS.filter((code) => code !== "zh" && code !== "zh-hans")) {
      expect(UI_DICTS[lang].values.siteTitle, lang).toBe("Minecraft Dungeons II Wiki");
    }
  });

  it("describes the comparison without naming a fixed language pair", () => {
    for (const lang of LANGS) {
      for (const key of COMPARE_KEYS) {
        const text = plainText(UI_DICTS[lang].values[key] ?? "");
        expect(text, `${lang}.${key}`).not.toMatch(/中英|Chinese and English|Chinese \/ English|繁體中文／英文/);
      }
    }
  });
});
