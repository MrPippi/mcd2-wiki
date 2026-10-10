import { describe, expect, it } from "vitest";
import { findEntry } from "../../../src/lib/data";
import { fillPlaceholder, fixedOn, tierRange, weaponEffectsOf, wikiPageUrl } from "../../../src/lib/weapon-effects";

const PLACEHOLDER = '<span class="placeholder">{value}</span>';

describe("fillPlaceholder", () => {
  it("puts the value where the game text has its one placeholder", () => {
    expect(fillPlaceholder(`Cuts cooldown by ${PLACEHOLDER}.`, "35%")).toBe('Cuts cooldown by <span class="value">35%</span>.');
  });

  it("leaves text with no placeholder, or several, as it is", () => {
    expect(fillPlaceholder("Hits explode!", "35%")).toBe("Hits explode!");
    const two = `${PLACEHOLDER} and ${PLACEHOLDER}`;
    expect(fillPlaceholder(two, "35%")).toBe(two);
  });
});

describe("tierRange", () => {
  it("spans tier I to tier III", () => {
    expect(tierRange(["5%", "10%", "15%"])).toBe("5%~15%");
  });

  it("gives one value when every tier is the same", () => {
    expect(tierRange(["2", "2", "2"])).toBe("2");
  });
});

describe("wikiPageUrl", () => {
  it("links a page title the way the wiki writes its URLs", () => {
    expect(wikiPageUrl("Dungeons II:Hunter's Hatchet")).toBe("https://minecraft.wiki/w/Dungeons_II:Hunter's_Hatchet");
  });
});

describe("weaponEffectsOf", () => {
  it("resolves compatible effects and a unique weapon's fixed effect to site entries", () => {
    const hatchet = findEntry("melee", "axe-unique1");
    const effects = hatchet ? weaponEffectsOf(hatchet) : undefined;
    expect(effects?.pageUrl).toBe("https://minecraft.wiki/w/Dungeons_II:Hunter's_Hatchet");
    expect(effects?.compatible.length).toBeGreaterThan(0);
    expect(effects?.compatible.every(({ effect }) => effect.category === "effect")).toBe(true);
    expect(effects?.fixed?.entry.name.en).toBe("Fletcher");
    expect(effects?.fixed?.value).toBe("35%");
  });

  it("fills a fixed bonus the wiki does not name from the manual list, with its own icon and no page", () => {
    const wrecker = findEntry("melee", "giant-club-unique1");
    const fixed = wrecker ? weaponEffectsOf(wrecker)?.fixed : undefined;
    expect(fixed?.entry.name.zh).toBe("炮烙魔法");
    expect(fixed?.entry.icon).toBe("icons/enchantment-book/flame-belch-unique.png");
    expect(fixed?.linked).toBe(false);
    expect(fixed?.value).toBe("80%");
  });

  it("is undefined for anything that is not a weapon", () => {
    const effect = findEntry("effect", "critical-edge");
    expect(effect ? weaponEffectsOf(effect) : "missing").toBeUndefined();
  });
});

describe("fixedOn", () => {
  it("lists the unique weapons that carry an enchantment as their fixed bonus", () => {
    const gravity = findEntry("enchantment", "gravity-pulse-unique");
    expect(gravity ? fixedOn(gravity).map((weapon) => weapon.slug) : []).toEqual(["greatsword-unique1"]);
  });

  it("is empty for an enchantment no weapon carries", () => {
    const arcane = findEntry("enchantment", "arcane");
    expect(arcane ? fixedOn(arcane) : ["missing"]).toEqual([]);
  });
});
