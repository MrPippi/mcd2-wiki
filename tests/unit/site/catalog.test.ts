import { describe, expect, it } from "vitest";
import { catalogLabel, categoryCount, entryNumber, setNumber } from "../../../src/lib/catalog";
import { allArmorSets, entriesIn } from "../../../src/lib/data";

describe("catalog numbers", () => {
  it("pads numbers to three digits", () => {
    expect(catalogLabel(1)).toBe("001");
    expect(catalogLabel(47)).toBe("047");
    expect(catalogLabel(1234)).toBe("1234");
  });

  it("numbers an entry by its place in its category list, from 1", () => {
    const [first, second] = entriesIn("melee");
    expect(entryNumber(first)).toBe(1);
    expect(entryNumber(second)).toBe(2);
  });

  it("returns undefined for an entry that is not published", () => {
    const ghost = { ...entriesIn("melee")[0], slug: "not-a-real-slug" };
    expect(entryNumber(ghost)).toBeUndefined();
  });

  it("numbers armor sets by their place in the set list", () => {
    expect(setNumber(allArmorSets[0])).toBe(1);
    expect(setNumber(allArmorSets[allArmorSets.length - 1])).toBe(allArmorSets.length);
  });

  it("counts armor by set and everything else by entry", () => {
    expect(categoryCount("armor")).toBe(allArmorSets.length);
    expect(categoryCount("melee")).toBe(entriesIn("melee").length);
    expect(categoryCount("enchantment")).toBe(entriesIn("enchantment").filter((entry) => entry.variant !== "unique").length);
  });
});
