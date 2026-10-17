import { describe, expect, it } from "vitest";
import { itemOdds } from "../../../src/lib/affix-odds";
import { affixData, affixViewOf } from "../../../src/lib/affix-view";
import { findEntry, publishedEntries } from "../../../src/lib/data";

const entry = (category: Parameters<typeof findEntry>[0], slug: string) => {
  const found = findEntry(category, slug);
  if (!found) throw new Error(`no ${category}/${slug}`);
  return found;
};
const probability = (level: number, effect: string, tier: number): number => {
  const odds = itemOdds(affixData, "war-hammer", { level, rarity: "rare", bonus: false });
  // A template that cannot roll at the level is not listed.
  return odds ? (odds.templates.find((found) => found.effect === effect && found.tier === tier)?.probability ?? 0) : NaN;
};

describe("the real War Hammer pool", () => {
  // Known values for a Rare War Hammer with one random effect (the extracted data reproduces them).
  it("reproduces the known Critical Edge odds", () => {
    expect(probability(1, "critical-edge", 1)).toBeCloseTo(0.123966941904, 9);
    expect(probability(3, "critical-edge", 1)).toBeCloseTo(0.112697219913, 9);
    expect(probability(20, "critical-edge", 1)).toBe(0);
    expect(probability(3, "critical-edge", 2)).toBeCloseTo(0.0112697219913, 9);
    expect(probability(20, "critical-edge", 2)).toBeCloseTo(0.061983470952, 9);
    expect(probability(5, "critical-edge", 3)).toBe(0);
    expect(probability(6, "critical-edge", 3)).toBeCloseTo(0.00826446, 7);
    expect(probability(20, "critical-edge", 3)).toBeCloseTo(0.061983470952, 9);
  });
});

describe("affixViewOf", () => {
  it("covers every published melee, ranged, armor and artifact entry", () => {
    const gear = publishedEntries.filter((one) => ["melee", "ranged", "armor", "artifact"].includes(one.category));
    expect(gear.length).toBeGreaterThan(200);
    expect(gear.filter((one) => affixViewOf(one) === undefined).map((one) => one.slug)).toEqual([]);
  });

  it("defaults to the highest threat and the first rarity, with the tier columns formatted", () => {
    const view = affixViewOf(entry("melee", "war-hammer"));
    expect(view).toMatchObject({ level: 20, rarity: "rare" });
    expect(view?.rarities.map((one) => one.rarity)).toEqual(["rare", "special"]);
    const row = view?.rows.find((one) => one.effect.slug === "critical-edge");
    expect(row?.tiers).toEqual(["0%", "6.20%", "6.20%"]);
    expect(row?.any).toBe("12.40%");
  });

  it("shows a unique piece's built-in effect first as 100%, and rolls only the Unique rarity", () => {
    const view = affixViewOf(entry("armor", "frost-rime-chest-unique"));
    expect(view?.rarities.map((one) => one.rarity)).toEqual(["unique"]);
    expect(view?.rows[0]).toMatchObject({ fixed: true, any: "100%" });
    expect(view?.rows[0].effect.slug).toBe("elemental-protection");
    expect(view?.rows.filter((one) => one.effect.slug === "elemental-protection")).toHaveLength(1);
  });

  it("sorts the rolled effects by English name", () => {
    const names = affixViewOf(entry("artifact", "firework-quiver"))?.rows.filter((one) => !one.fixed).map((one) => one.effect.name.en) ?? [];
    expect(names.length).toBeGreaterThan(5);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("has nothing for other categories", () => {
    expect(affixViewOf(entry("effect", "sharpness"))).toBeUndefined();
  });
});
