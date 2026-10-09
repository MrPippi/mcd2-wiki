import { describe, expect, it } from "vitest";
import { frameFor } from "../../../src/lib/frames";

const ALL = {
  enchantment: "icons/frames/enchantment.png",
  artifact: "icons/frames/artifact.png",
};

describe("frameFor", () => {
  it("draws gear and statuses in the CSS inventory slot", () => {
    expect(frameFor("melee", ALL)).toEqual({ name: "inventory" });
    expect(frameFor("armor", ALL)).toEqual({ name: "inventory" });
    expect(frameFor("status", ALL)).toEqual({ name: "inventory" });
  });

  it("draws talismans and cosmetics in the inventory slot", () => {
    for (const category of ["talisman", "cape", "pet", "skin"] as const) {
      expect(frameFor(category, ALL)).toEqual({ name: "inventory" });
    }
  });

  it("frames artifacts with the hotbar artifact slot", () => {
    expect(frameFor("artifact", ALL)).toEqual({ name: "artifact", path: "icons/frames/artifact.png" });
  });

  it("falls back to the inventory slot when the artifact slot was not extracted", () => {
    expect(frameFor("artifact", {})).toEqual({ name: "inventory" });
  });

  it("frames enchantments and books with the book slot", () => {
    expect(frameFor("enchantment", ALL)).toEqual({ name: "enchantment", path: "icons/frames/enchantment.png" });
    expect(frameFor("enchantment-book", ALL)).toEqual({ name: "enchantment", path: "icons/frames/enchantment.png" });
  });

  it("returns nothing for effects or when the book slot was not extracted", () => {
    expect(frameFor("effect", ALL)).toBeUndefined();
    expect(frameFor("enchantment", {})).toBeUndefined();
  });

  it("uses the extracted frames by default", () => {
    expect(frameFor("artifact")?.path).toBe("icons/frames/artifact.png");
  });
});
