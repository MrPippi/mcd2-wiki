import { describe, expect, it } from "vitest";
import { gameHtml, gameText, localize, resolveTexts } from "../../../scripts/extract/game-text";
import { makeLocales, ns } from "../../helpers/locales";
import { loc } from "../../helpers/localized";

const locales = {
  ...makeLocales({
    [ns("VendorLabels")]: {
      smith: { en: "Blacksmith", zh: "鐵匠", ja: "鍛冶屋" },
      cost: { en: "Cost", zh: "", ja: "" },
      bold: { en: "<emphasis>Hit</>", zh: "<emphasis>打</>" },
    },
  }),
  de: {},
};

describe("gameText", () => {
  it("returns every language and lists the ones that show English", () => {
    const found = gameText(locales, ns("VendorLabels"), "smith");
    expect(found?.text.zh).toBe("鐵匠");
    expect(found?.text.de).toBe("Blacksmith");
    expect(found?.untranslated).toEqual(["de"]);
  });

  it("falls back to English for empty texts and missing namespaces", () => {
    const found = gameText(locales, ns("VendorLabels"), "cost");
    expect(found?.text).toEqual(loc({ en: "Cost" }));
    expect(found?.untranslated).not.toContain("en");
    expect(found?.untranslated).toContain("zh");
    expect(found?.untranslated).toContain("de");
  });

  it("returns undefined without English", () => {
    expect(gameText(locales, ns("VendorLabels"), "nope")).toBeUndefined();
    expect(gameText(locales, ns("Nope"), "smith")).toBeUndefined();
  });

  it("shows English for a rejected translation and lists the language", () => {
    const reject = (lang: string, text: string | undefined) => (lang === "zh" ? undefined : text);
    const found = gameText(locales, ns("VendorLabels"), "smith", reject);
    expect(found?.text.zh).toBe("Blacksmith");
    expect(found?.text.ja).toBe("鍛冶屋");
    expect(found?.untranslated).toContain("zh");
  });

  it("has no text when English itself is rejected", () => {
    expect(gameText(locales, ns("VendorLabels"), "smith", () => undefined)).toBeUndefined();
  });
});

describe("resolveTexts", () => {
  it("works on a plain record of texts", () => {
    const found = resolveTexts({ en: "Hi", ja: "やあ" });
    expect(found?.text.ja).toBe("やあ");
    expect(found?.text.ko).toBe("Hi");
    expect(found?.untranslated).not.toContain("ja");
    expect(found?.untranslated).toContain("ko");
  });

  it("returns undefined for no texts", () => {
    expect(resolveTexts(undefined)).toBeUndefined();
  });
});

describe("gameHtml", () => {
  it("renders the markup of every language, English included for fallbacks", () => {
    const found = gameHtml(locales, ns("VendorLabels"), "bold");
    expect(found?.html.zh).toContain("打");
    expect(found?.html.de).toContain("Hit");
    expect(found?.html.zh).not.toContain("<emphasis>");
    expect(found?.untranslated).toContain("de");
  });

  it("returns undefined without English", () => {
    expect(gameHtml(locales, ns("VendorLabels"), "nope")).toBeUndefined();
  });
});

describe("localize", () => {
  it("is the text of gameText", () => {
    expect(localize(locales, ns("VendorLabels"), "smith")).toEqual(gameText(locales, ns("VendorLabels"), "smith")?.text);
    expect(localize(locales, ns("VendorLabels"), "nope")).toBeUndefined();
  });
});
