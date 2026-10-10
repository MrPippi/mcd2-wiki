import { describe, expect, it } from "vitest";
import { findBaseEntry, findEntry, publishedEntries } from "../../../src/lib/data";
import { artifactStatsView, describedEntry, enchantmentTiers, fillPlaceholders } from "../../../src/lib/gear-values";

const SLOT = (n: number) => `<span class="placeholder" data-slot="${n}">{value}</span>`;
const RU_SECONDS = { one: "секунду", few: "секунды", many: "секунд", other: "секунды (other)" };
const plural = (n: number, forms: Record<string, string>) =>
  `<span class="plural" data-slot="${n}" data-forms="${JSON.stringify(forms).replace(/"/g, "&quot;")}"></span>`;

describe("fillPlaceholders", () => {
  it("fills placeholders in order and leaves extra ones alone", () => {
    expect(fillPlaceholders(`${SLOT(0)} and ${SLOT(1)}`, ["20%", "125%"], "en")).toBe(
      '<span class="value">20%</span> and <span class="value">125%</span>',
    );
    expect(fillPlaceholders(`${SLOT(0)} and ${SLOT(1)}`, ["20%"], "en")).toBe(`<span class="value">20%</span> and ${SLOT(1)}`);
  });
});

describe("fillPlaceholders by slot", () => {
  it("fills placeholders by slot, not by order of appearance", () => {
    const html = '移動超過 <span class="placeholder" data-slot="1">{數值}</span> 秒後，提高 <span class="placeholder" data-slot="0">{數值}</span>。';
    expect(fillPlaceholders(html, ["20%", "3"], "zh")).toBe('移動超過 <span class="value">3</span> 秒後，提高 <span class="value">20%</span>。');
  });

  it("picks the plural form for the value by the page language's rules", () => {
    const html = `${SLOT(0)} ${plural(0, RU_SECONDS)}`;
    expect(fillPlaceholders(html, ["5"], "ru")).toBe('<span class="value">5</span> <span class="plural">секунд</span>');
    expect(fillPlaceholders(html, ["1"], "ru")).toBe('<span class="value">1</span> <span class="plural">секунду</span>');
    expect(fillPlaceholders(html, ["3"], "ru")).toBe('<span class="value">3</span> <span class="plural">секунды</span>');
  });

  it("takes the other form for a value that is not a number", () => {
    expect(fillPlaceholders(plural(0, RU_SECONDS), ["—"], "ru")).toBe('<span class="plural">секунды (other)</span>');
  });

  it("falls back to other, then the first form, when the language's category is missing", () => {
    expect(fillPlaceholders(plural(0, { one: "секунду", other: "секунды" }), ["5"], "ru")).toBe('<span class="plural">секунды</span>');
    expect(fillPlaceholders(plural(0, { one: "секунду" }), ["5"], "ru")).toBe('<span class="plural">секунду</span>');
  });

  it("leaves a plural slot with no value unchanged", () => {
    const html = plural(1, RU_SECONDS);
    expect(fillPlaceholders(html, ["5"], "ru")).toBe(html);
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
