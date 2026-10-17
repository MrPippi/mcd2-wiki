import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runtimeImports } from "../../helpers/imports";
import { bestColumns, compareSearch, decodeCompare, MAX_WEAPONS, placeWeapon, removeWeapon } from "../../../src/lib/compare/code";

const KNOWN = new Set(["sword", "axe", "bow", "crossbow"]);

describe("placeWeapon", () => {
  it("replaces a filled column and appends past the last one", () => {
    expect(placeWeapon(["sword", "axe"], 1, "bow")).toEqual(["sword", "bow"]);
    expect(placeWeapon(["sword"], 2, "bow")).toEqual(["sword", "bow"]);
    expect(placeWeapon([], 0, "bow")).toEqual(["bow"]);
  });

  it("keeps a weapon in its earlier column instead of repeating it", () => {
    expect(placeWeapon(["sword", "axe"], 2, "sword")).toEqual(["sword", "axe"]);
    expect(placeWeapon(["sword", "axe"], 1, "sword")).toEqual(["sword"]);
  });

  it("never holds more than three", () => {
    expect(placeWeapon(["sword", "axe", "bow"], 5, "crossbow")).toHaveLength(MAX_WEAPONS);
  });
});

describe("removeWeapon", () => {
  it("empties a column and moves later ones left", () => {
    expect(removeWeapon(["sword", "axe", "bow"], 0)).toEqual(["axe", "bow"]);
    expect(removeWeapon(["sword"], 2)).toEqual(["sword"]);
  });
});

describe("decodeCompare", () => {
  it("keeps known, distinct slugs up to three", () => {
    expect(decodeCompare("?w=sword,axe,bow", KNOWN)).toEqual({ slugs: ["sword", "axe", "bow"], dropped: 0 });
    expect(MAX_WEAPONS).toBe(3);
  });

  it("drops unknown, repeated and extra slugs and counts them", () => {
    expect(decodeCompare("?w=sword,dragon,sword,axe,bow,crossbow", KNOWN)).toEqual({ slugs: ["sword", "axe", "bow"], dropped: 3 });
  });

  it("reads nothing from an empty or unrelated query", () => {
    expect(decodeCompare("", KNOWN)).toEqual({ slugs: [], dropped: 0 });
    expect(decodeCompare("?ref=x&w=", KNOWN)).toEqual({ slugs: [], dropped: 0 });
  });
});

describe("compareSearch", () => {
  it("writes readable commas and keeps other parameters", () => {
    expect(compareSearch("?ref=x&w=bow", ["sword", "axe"])).toBe("?ref=x&w=sword,axe");
  });

  it("is empty when nothing is compared and nothing else is there", () => {
    expect(compareSearch("?w=sword", [])).toBe("");
  });

  it("escapes characters a slug should never have", () => {
    expect(compareSearch("", ["a&b"])).toBe("?w=a%26b");
  });
});

describe("bestColumns", () => {
  it("marks the highest when higher is better, and every tie", () => {
    expect(bestColumns([10, 30, 30], "high")).toEqual([1, 2]);
  });

  it("marks the lowest when lower is better, skipping missing values", () => {
    expect(bestColumns([2, undefined, 1.5], "low")).toEqual([2]);
  });

  it("marks nothing with fewer than two values, when all tie, or for unranked rows", () => {
    expect(bestColumns([5, undefined], "high")).toEqual([]);
    expect(bestColumns([5, 5], "high")).toEqual([]);
    expect(bestColumns([1, 2], "none")).toEqual([]);
  });
});

describe("module boundaries", () => {
  it("loads nothing at run time", () => {
    expect(runtimeImports(readFileSync(path.resolve(__dirname, "../../../src/lib/compare/code.ts"), "utf8"))).toEqual([]);
  });
});
