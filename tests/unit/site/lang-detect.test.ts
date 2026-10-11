import { describe, expect, it } from "vitest";
import { detectLang } from "../../../src/lib/lang-detect";

describe("detectLang", () => {
  it.each([
    ["zh-HK", "zh"],
    ["zh-TW", "zh"],
    ["zh-MO", "zh"],
    ["zh-Hant-TW", "zh"],
    ["zh-SG", "zh-hans"],
    ["zh-CN", "zh-hans"],
    ["zh-Hans", "zh-hans"],
    ["zh", "zh"],
    ["pt-PT", "pt"],
    ["pt-BR", "pt"],
    ["en-GB", "en"],
    ["es-MX", "es"],
    ["ja-JP", "ja"],
    ["ZH-cn", "zh-hans"],
  ])("maps the browser language %s to %s", (browser, expected) => {
    expect(detectLang(null, [browser])).toBe(expected);
  });

  it("prefers a valid stored choice", () => {
    expect(detectLang("ja", ["de"])).toBe("ja");
  });

  it("ignores an unknown stored choice", () => {
    expect(detectLang("xx", ["de-AT"])).toBe("de");
  });

  it("walks the browser list in order, skipping unsupported languages", () => {
    expect(detectLang(null, ["xx-YY", "sv-SE", "de"])).toBe("sv");
  });

  it("falls back to Traditional Chinese", () => {
    expect(detectLang(null, [])).toBe("zh");
    expect(detectLang(null, ["xx", "yy-ZZ"])).toBe("zh");
  });
});
