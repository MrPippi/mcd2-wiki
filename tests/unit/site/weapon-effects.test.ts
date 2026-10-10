import { describe, expect, it } from "vitest";
import { findEntry } from "../../../src/lib/data";
import { fillPlaceholder, weaponEffectsOf, wikiPageUrl } from "../../../src/lib/weapon-effects";

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

  it("is undefined for anything that is not a weapon", () => {
    const effect = findEntry("effect", "critical-edge");
    expect(effect ? weaponEffectsOf(effect) : "missing").toBeUndefined();
  });
});
