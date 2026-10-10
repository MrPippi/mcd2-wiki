import { describe, expect, it } from "vitest";
import { describedEntry, describedLong } from "../../../src/lib/gear-values";
import { makeEntry } from "../../helpers/entries";
import { allArmorSets, booksFor, hasRequiredIcon, entriesIn, findArmorSet, findEntry, publishedEntries } from "../../../src/lib/data";

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
    // Unique enchantments come fixed on unique gear, never as books.
    expect(booksFor("fire-aspect-unique")).toEqual([]);
    expect(publishedEntries.some((entry) => entry.category === "enchantment-book" && entry.variant === "unique")).toBe(false);
  });

  it("publishes only entries that have the icon their category requires", () => {
    // The game's IconReference names these icons; before it was read they had none and stayed hidden.
    for (const slug of ["clawing-shadow-unique", "multi-potion", "mauler-dive", "phantom-lance"]) {
      expect(findEntry("enchantment", slug)?.icon, slug).toBeDefined();
    }
    for (const category of ["melee", "ranged", "armor", "artifact", "talisman", "enchantment"] as const) {
      expect(entriesIn(category).every((entry) => entry.icon !== undefined), category).toBe(true);
    }
  });

  it("requires an icon on gear and enchantments but not on effects", () => {
    expect(hasRequiredIcon(makeEntry("Sword", "melee"))).toBe(false);
    expect(hasRequiredIcon(makeEntry("Arcane", "enchantment"))).toBe(false);
    expect(hasRequiredIcon(makeEntry("Sword", "melee", { icon: "icons/melee/sword.png" }))).toBe(true);
    expect(hasRequiredIcon(makeEntry("CriticalEdge", "effect"))).toBe(true);
  });

  it("keeps categories that never have icons", () => {
    expect(entriesIn("effect").length).toBeGreaterThan(0);
  });

  it("hides effects, enchantments and talismans whose description has a value the game data cannot fill", () => {
    const shown = publishedEntries.filter((entry) => ["effect", "enchantment", "talisman"].includes(entry.category));
    const unfilled = shown.filter((entry) => /class="placeholder"/.test(`${describedEntry(entry)?.zh ?? ""}${describedLong(entry)?.zh ?? ""}`));
    expect(unfilled.map((entry) => entry.slug)).toEqual([]);
    expect(findEntry("enchantment", "shadow-strike")).toBeDefined();
    expect(findEntry("effect", "critical-edge")).toBeDefined();
    expect(findEntry("enchantment", "gravity-pulse")).toBeUndefined();
    expect(findEntry("enchantment-book", "fire-aspect-ii")).toBeUndefined();
    expect(findEntry("enchantment", "fire-aspect-ii")).toBeUndefined();
    expect(findEntry("effect", "jumpshot")).toBeUndefined();
  });

  it("gives every published non-unique enchantment at least one book", () => {
    const normal = entriesIn("enchantment").filter((entry) => entry.variant === "normal");
    expect(normal.filter((entry) => booksFor(entry.slug).length === 0)).toEqual([]);
  });

  it("finds armor sets", () => {
    expect(allArmorSets.length).toBeGreaterThan(0);
    expect(findArmorSet("disciple")?.name.en).toBe("Disciple");
  });
});
