import { describe, expect, it } from "vitest";
import { categoryIcon, groupIcon, pieceIcon } from "../../../src/lib/ui-icons";

const ICONS = {
  melee: "icons/ui/melee.png",
  armor: "icons/ui/armor.png",
  boots: "icons/ui/boots.png",
  equipment: "icons/ui/equipment.png",
};

describe("ui icons", () => {
  it("finds the icon for a site category", () => {
    expect(categoryIcon("melee", ICONS)).toBe("icons/ui/melee.png");
    expect(categoryIcon("armor", ICONS)).toBe("icons/ui/armor.png");
  });

  it("uses the game's tab icons for talismans, capes and pets", () => {
    expect(categoryIcon("talisman")).toBe("icons/ui/talisman.png");
    expect(categoryIcon("cape")).toBe("icons/ui/cape.png");
    expect(categoryIcon("pet")).toBe("icons/ui/pet.png");
    expect(categoryIcon("skin")).toBeUndefined();
  });

  it("has no icon for categories the game gives none, or when it was not extracted", () => {
    expect(categoryIcon("artifact", ICONS)).toBeUndefined();
    expect(categoryIcon("status", ICONS)).toBeUndefined();
    expect(categoryIcon("ranged", ICONS)).toBeUndefined();
  });

  it("finds armor piece and navigation group icons", () => {
    expect(pieceIcon("boots", ICONS)).toBe("icons/ui/boots.png");
    expect(groupIcon("equipment", ICONS)).toBe("icons/ui/equipment.png");
    expect(groupIcon("enchanting", ICONS)).toBeUndefined();
  });

  it("uses the extracted icons by default", () => {
    expect(categoryIcon("melee")).toBe("icons/ui/melee.png");
  });
});
