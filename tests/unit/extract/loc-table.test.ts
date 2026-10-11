import { describe, expect, it } from "vitest";
import { englishFallbacks, gameTexts, localize, locRef } from "../../../scripts/extract/loc-table";
import { makeLocales, ns } from "../../helpers/locales";
import { loc } from "../../helpers/localized";

describe("locRef", () => {
  it("reads the table and key of a LOCTABLE reference", () => {
    expect(locRef('LOCTABLE("VendorLabels.csv", "vendor_blacksmith_titleshort")')).toEqual({
      namespace: "Text/Release/VendorLabels.csv",
      key: "vendor_blacksmith_titleshort",
    });
  });

  it("ignores plain text", () => {
    expect(locRef("Blacksmith")).toBeUndefined();
    expect(locRef("None")).toBeUndefined();
  });
});

describe("localize", () => {
  const locales = {
    ...makeLocales({
      [ns("VendorLabels")]: { smith: { en: "Blacksmith", zh: "鐵匠", ja: "鍛冶屋" }, cost: { en: "Cost", zh: "", ja: "" } },
    }),
    de: {},
  };

  it("returns every language", () => {
    expect(localize(locales, ns("VendorLabels"), "smith")).toEqual(loc({ en: "Blacksmith", zh: "鐵匠", ja: "鍛冶屋" }));
  });

  it("falls back to English for an empty text or a language without the namespace", () => {
    expect(localize(locales, ns("VendorLabels"), "cost")).toEqual(loc({ en: "Cost" }));
    expect(localize(locales, ns("VendorLabels"), "smith")?.de).toBe("Blacksmith");
  });

  it("returns undefined when the key is missing", () => {
    expect(localize(locales, ns("VendorLabels"), "nope")).toBeUndefined();
    expect(localize(locales, ns("Nope"), "smith")).toBeUndefined();
  });
});

describe("gameTexts", () => {
  const locales = {
    ...makeLocales({ [ns("VendorLabels")]: { smith: { en: "Blacksmith", zh: "鐵匠", ja: "" } } }),
    de: {},
  };

  it("keeps only the languages the game really has", () => {
    const texts = gameTexts(locales, ns("VendorLabels"), "smith");
    expect(texts).toMatchObject({ en: "Blacksmith", zh: "鐵匠" });
    expect(texts).not.toHaveProperty("ja");
    expect(texts).not.toHaveProperty("de");
  });

  it("returns undefined without English", () => {
    expect(gameTexts(locales, ns("VendorLabels"), "nope")).toBeUndefined();
  });

  it("lists the languages that fall back to English", () => {
    expect(englishFallbacks(locales, ns("VendorLabels"), "smith")).toEqual(["ja", "de"]);
    expect(englishFallbacks(locales, ns("VendorLabels"), "nope")).toEqual([]);
  });
});
