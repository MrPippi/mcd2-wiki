import { describe, expect, it } from "vitest";
import { allArmorSets, entriesIn, findArmorSet, findEntry, publishedEntries } from "../../../src/lib/data";

describe("site data", () => {
  it("publishes only base entries", () => {
    expect(publishedEntries.length).toBeGreaterThan(0);
    expect(publishedEntries.every((entry) => entry.release === "base")).toBe(true);
  });

  it("finds entries by category and slug", () => {
    expect(findEntry("melee", "sword")?.name).toEqual({ zh: "劍", en: "Sword" });
    expect(findEntry("melee", "does-not-exist")).toBeUndefined();
    expect(entriesIn("melee").every((entry) => entry.category === "melee")).toBe(true);
  });

  it("finds armor sets", () => {
    expect(allArmorSets.length).toBeGreaterThan(0);
    expect(findArmorSet("disciple")?.name.en).toBe("Disciple");
  });
});
