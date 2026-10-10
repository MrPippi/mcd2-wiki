import { describe, expect, it } from "vitest";
import { localize, locRef } from "../../../scripts/extract/loc-table";
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

describe("localize", () => {
  const locales = makeLocales({
    [ns("VendorLabels")]: { smith: ["Blacksmith", "鐵匠"], cost: ["Cost", ""] },
  });

  it("returns both languages", () => {
    expect(localize(locales, ns("VendorLabels"), "smith")).toEqual({ zh: "鐵匠", en: "Blacksmith" });
  });

  it("falls back to English when Chinese is empty", () => {
    expect(localize(locales, ns("VendorLabels"), "cost")).toEqual({ zh: "Cost", en: "Cost" });
  });

  it("returns undefined when the key is missing", () => {
    expect(localize(locales, ns("VendorLabels"), "nope")).toBeUndefined();
    expect(localize(locales, ns("Nope"), "smith")).toBeUndefined();
  });
});
