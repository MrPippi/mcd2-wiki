import { describe, expect, it } from "vitest";
import { findBaseEntry, findEntry, publishedEntries } from "../../../src/lib/data";
import { artifactStatsView, describedEntry, enchantmentTiers, fillPlaceholders } from "../../../src/lib/gear-values";

const PLACEHOLDER = '<span class="placeholder">{value}</span>';

describe("fillPlaceholders", () => {
  it("fills placeholders in order and leaves extra ones alone", () => {
    expect(fillPlaceholders(`${PLACEHOLDER} and ${PLACEHOLDER}`, ["20%", "125%"])).toBe(
      '<span class="value">20%</span> and <span class="value">125%</span>',
    );
    expect(fillPlaceholders(`${PLACEHOLDER} and ${PLACEHOLDER}`, ["20%"])).toBe(`<span class="value">20%</span> and ${PLACEHOLDER}`);
  });
});

describe("enchantmentTiers", () => {
  it("gives an enchantment its description filled at each tier", () => {
    const shadow = findEntry("enchantment", "shadow-strike");
    const tiers = shadow ? enchantmentTiers(shadow) : undefined;
    expect(tiers?.map((tier) => tier.label)).toEqual(["I", "II", "III"]);
    expect(tiers?.[0].text.en).toContain('<span class="value">15%</span>');
  });

  it("is undefined for enchantments the game data gives no values for", () => {
    const gravity = findBaseEntry("enchantment", "gravity-pulse");
    expect(gravity ? enchantmentTiers(gravity) : "missing").toBeUndefined();
  });
});

describe("describedEntry", () => {
  it("fills an enchantment's description with its tier I–III range", () => {
    const shockwave = findEntry("enchantment", "shockwave");
    const text = shockwave ? describedEntry(shockwave) : undefined;
    expect(text?.zh).toContain('<span class="value">20%~50%</span>');
    expect(text?.zh).toContain('<span class="value">125%~175%</span>');
  });

  it("fills an effect's description with its tier I–III range", () => {
    const edge = findEntry("effect", "critical-edge");
    expect(edge ? describedEntry(edge)?.zh : undefined).toContain('<span class="value">10%~30%</span>');
  });

  it("fills an enchantment book with its enchantment's values", () => {
    const book = findBaseEntry("enchantment-book", "phantom-lance");
    expect(book ? describedEntry(book)?.zh : undefined).toContain('<span class="value">90%</span>');
  });

  it("leaves other entries' descriptions as they are", () => {
    const sword = findEntry("melee", "sword");
    expect(sword ? describedEntry(sword) : undefined).toEqual(sword?.description);
  });
});

describe("artifactStatsView", () => {
  it("prints cooldown, soul cost and the extra numbers an artifact has", () => {
    const totem = findEntry("artifact", "totem-of-shielding");
    const view = totem ? artifactStatsView("zh", totem) : undefined;
    expect(view?.map((row) => row.label)).toEqual(["冷卻時間", "靈魂消耗", "持續時間", "範圍"]);
    expect(view?.[0].value).toMatch(/秒$/);
    expect(view?.[3].value).toBe("12 格");
  });
});
