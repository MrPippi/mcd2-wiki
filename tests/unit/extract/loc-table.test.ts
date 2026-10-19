import { describe, expect, it } from "vitest";
import { gameTexts, locRef } from "../../../scripts/extract/loc-table";
import { makeLocales, ns } from "../../helpers/locales";

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
});
