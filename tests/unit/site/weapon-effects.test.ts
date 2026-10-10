import { describe, expect, it } from "vitest";
import { findEntry } from "../../../src/lib/data";
import { fixedOn, formatMagnitude, tierRange, weaponEffectsOf } from "../../../src/lib/weapon-effects";

const PERCENT = { percent: true, multiplier: 1, offset: 0, maxFractionDigits: 2 };

const weaponOf = (category: "melee" | "ranged", slug: string) => {
  const weapon = findEntry(category, slug);
  return weapon ? weaponEffectsOf(weapon) : undefined;
};

describe("tierRange", () => {
  it("spans tier I to tier III, or gives one value when they match", () => {
    expect(tierRange(["5%", "10%", "15%"])).toBe("5%~15%");
    expect(tierRange(["2", "2", "2"])).toBe("2");
  });
});

describe("formatMagnitude", () => {
  it("prints a magnitude the way the effect's description does", () => {
    expect(formatMagnitude(0.1, PERCENT)).toBe("10%");
    expect(formatMagnitude(-0.35, { ...PERCENT, multiplier: -1 })).toBe("35%");
    expect(formatMagnitude(0.123456, PERCENT)).toBe("12.35%");
    expect(formatMagnitude(2, { ...PERCENT, percent: false })).toBe("2");
  });
});

describe("weaponEffectsOf", () => {
  it("lists the effects a weapon can roll with their printed tier values", () => {
    const hatchet = weaponOf("melee", "axe-unique1");
    const edge = hatchet?.compatible.find(({ effect }) => effect.slug === "critical-edge");
    expect(edge?.values).toEqual(["10%", "20%", "30%"]);
  });

  it("reads a unique weapon's built-in effect and its value from the game data", () => {
    const fixed = weaponOf("melee", "axe-unique1")?.fixed;
    expect(fixed).toMatchObject({ kind: "effect", values: ["35%"], linked: true, manualValue: false });
    expect(fixed?.entry.name.en).toBe("Fletcher");
  });

  it("shows Redstone Wrecker's Pyromancy from its book, unlinked, with the value computed from the game data", () => {
    const fixed = weaponOf("melee", "giant-club-unique1")?.fixed;
    expect(fixed?.entry.name.zh).toBe("炮烙魔法");
    expect(fixed?.entry.icon).toBe("icons/enchantment-book/flame-belch-unique.png");
    expect(fixed).toMatchObject({ kind: "enchantment", values: ["80%"], linked: false, manualValue: false });
  });

  it("uses the hand-checked value where the game reads it from an ability", () => {
    expect(weaponOf("melee", "great-axe-unique1")?.fixed).toMatchObject({ values: ["70%"], manualValue: true });
  });

  it("covers ranged weapons, which the wiki did not", () => {
    const reach = weaponOf("ranged", "longbow-unique1");
    expect(reach?.compatible.length).toBeGreaterThan(0);
    expect(reach?.fixed?.entry.name.en).toBe("Sniper");
    expect(reach?.fixed?.values).toEqual(["100%"]);
  });

  it("gives artifacts the effects they can roll, with no fixed bonus", () => {
    const totem = findEntry("artifact", "totem-of-shielding");
    const effects = totem ? weaponEffectsOf(totem) : undefined;
    expect(effects?.compatible.map(({ effect }) => effect.slug)).toContain("cooldown");
    expect(effects?.fixed).toBeUndefined();
  });

  it("is undefined for anything without rollable effects", () => {
    const effect = findEntry("effect", "critical-edge");
    expect(effect ? weaponEffectsOf(effect) : "missing").toBeUndefined();
  });
});

describe("fixedOn", () => {
  it("lists the unique weapons that carry an enchantment as their fixed bonus", () => {
    const shockwave = findEntry("enchantment", "shockwave");
    expect(shockwave ? fixedOn(shockwave).map((weapon) => weapon.slug) : []).toEqual(["shovel-unique1"]);
  });

  it("is empty for an enchantment no weapon carries", () => {
    const arcane = findEntry("enchantment", "arcane");
    expect(arcane ? fixedOn(arcane) : ["missing"]).toEqual([]);
  });
});
