import { describe, expect, it } from "vitest";
import { ExtractError } from "../../../scripts/extract/issues";
import { iconWebPath, sortEntries, validateOutput } from "../../../scripts/extract/output";
import { makeEntry } from "../../helpers/entries";

describe("output helpers", () => {
  it("builds icon web paths", () => {
    expect(iconWebPath("melee", "sword")).toBe("icons/melee/sword.png");
  });

  it("sorts by category order then slug without mutating the input", () => {
    const input = [makeEntry("Aim", "effect"), makeEntry("Sword", "melee"), makeEntry("Axe", "melee")];
    expect(sortEntries(input).map((e) => e.slug)).toEqual(["axe", "sword", "aim"]);
    expect(input.map((e) => e.slug)).toEqual(["aim", "sword", "axe"]);
  });

  it("rejects invalid output", () => {
    expect(() => validateOutput([makeEntry("Sword", "melee", { slug: "Bad Slug" })], [])).toThrow(ExtractError);
    expect(() => validateOutput([makeEntry("Sword", "melee", { slug: "Bad Slug" })], [])).toThrow(/輸出條目驗證失敗/);
  });

  it("returns validated data", () => {
    const entries = [makeEntry("Sword", "melee")];
    expect(validateOutput(entries, [])).toEqual({ entries, armorSets: [] });
  });
});
