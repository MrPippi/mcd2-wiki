import { describe, expect, it } from "vitest";
import rawEntries from "../../../src/data/entries.json";
import { allArmorSets, booksFor, entriesIn, findArmorSet, findEntry, publishedEntries } from "../../../src/lib/data";

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

  it("finds the enchantment books that grant an enchantment", () => {
    expect(booksFor("arcane").map((book) => book.id)).toEqual(["EnchantmentBook_Arcane"]);
    expect(booksFor("fire-aspect-unique").map((book) => book.id)).toEqual(["EnchantmentBook_FireAspect_Unique"]);
  });

  it("hides entries that should have an icon but have none", () => {
    expect(findEntry("enchantment", "clawing-shadow-unique")).toBeUndefined();
    expect(findEntry("enchantment", "multi-potion")).toBeUndefined();
    for (const category of ["melee", "ranged", "armor", "artifact", "talisman", "enchantment"] as const) {
      expect(entriesIn(category).every((entry) => entry.icon !== undefined), category).toBe(true);
    }
  });

  it("keeps categories that never have icons", () => {
    expect(entriesIn("effect").length).toBeGreaterThan(0);
  });

  it("publishes every base effect whether or not the game has an icon for it", () => {
    const effects = rawEntries.filter((entry) => entry.category === "effect" && entry.release === "base");
    expect(entriesIn("effect")).toHaveLength(effects.length);
    expect(entriesIn("effect").some((entry) => entry.icon !== undefined)).toBe(true);
  });

  it("gives every published enchantment at least one book", () => {
    expect(entriesIn("enchantment").filter((entry) => booksFor(entry.slug).length === 0)).toEqual([]);
  });

  it("finds armor sets", () => {
    expect(allArmorSets.length).toBeGreaterThan(0);
    expect(findArmorSet("disciple")?.name.en).toBe("Disciple");
  });
});
