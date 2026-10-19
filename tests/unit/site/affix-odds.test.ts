import { describe, expect, it } from "vitest";
import { affixOdds, entryWeight, MAX_SLOTS, formatOdds, itemOdds, type AffixEntry, type AffixFile, type AffixModel, type TierFactors } from "../../../shared/affix-odds";

const FLAT: TierFactors = [1, 1, 1];
const entry = (effect: string, tier: 1 | 2 | 3, ...ops: [AffixEntry["ops"][number][0], number][]): AffixEntry => ({ effect, tier, ops });
const model = (...entries: AffixEntry[]): AffixModel => ({ entries });
const templateOf = (result: ReturnType<typeof affixOdds>, effect: string, tier: number) =>
  result.templates.find((found) => found.effect === effect && found.tier === tier)?.probability ?? 0;
const effectOf = (result: ReturnType<typeof affixOdds>, effect: string) => result.effects.find((found) => found.effect === effect)?.probability ?? 0;

describe("entryWeight", () => {
  it("takes the largest Set, sums Add, and multiplies the Multiply entries", () => {
    expect(entryWeight(entry("a", 1, ["set", 1], ["set", 0.75]), FLAT)).toBe(1);
    expect(entryWeight(entry("a", 1, ["set", 1], ["add", 0.5]), FLAT)).toBe(1.5);
    expect(entryWeight(entry("a", 1, ["set", 1], ["multiply", 0.5], ["multiply", 0.5]), FLAT)).toBe(0.25);
  });

  it("scales the combined Set, Add and Multiply once each by the tier factor", () => {
    expect(entryWeight(entry("a", 2, ["set", 1], ["multiply", 0.5]), [1, 0.5, 1])).toBeCloseTo(0.5 * 0.25);
    // Three Multiply entries (the real PoisonFocus under Frost) are scaled once, not three times.
    expect(entryWeight(entry("a", 1, ["set", 1], ["multiply", 0.3], ["multiply", 0.3], ["multiply", 0.3]), [0.5, 1, 1])).toBeCloseTo(0.5 * 0.027 * 0.5);
    expect(entryWeight(entry("a", 1, ["set", 1], ["add", 1]), [0.5, 1, 1])).toBeCloseTo(1);
    expect(entryWeight(entry("a", 3, ["set", 1]), [1, 1, 0.1])).toBeCloseTo(0.1);
  });

  it("is zero without a Set or Add entry, and never negative", () => {
    expect(entryWeight(entry("a", 1, ["multiply", 0.3]), FLAT)).toBe(0);
    expect(entryWeight(entry("a", 1, ["set", 1], ["add", -3]), FLAT)).toBe(0);
  });
});

describe("affixOdds", () => {
  it("draws one slot by weight, and splits an effect over its tiers", () => {
    const result = affixOdds(model(entry("a", 1, ["set", 1]), entry("a", 2, ["set", 1]), entry("b", 1, ["set", 2])), FLAT, 1);
    expect(effectOf(result, "a")).toBeCloseTo(0.5);
    expect(templateOf(result, "a", 2)).toBeCloseTo(0.25);
    expect(templateOf(result, "b", 1)).toBeCloseTo(0.5);
  });

  it("removes every tier of an effect once it is drawn", () => {
    const result = affixOdds(model(entry("a", 1, ["set", 1]), entry("a", 2, ["set", 1]), entry("b", 1, ["set", 2])), FLAT, 2);
    expect(effectOf(result, "a")).toBeCloseTo(1);
    expect(effectOf(result, "b")).toBeCloseTo(1);
    expect(templateOf(result, "a", 1)).toBeCloseTo(0.5);
  });

  it("sums every draw order (weights 1, 1, 2 and two slots)", () => {
    const result = affixOdds(model(entry("a", 1, ["set", 1]), entry("b", 1, ["set", 1]), entry("c", 1, ["set", 2])), FLAT, 2);
    expect(effectOf(result, "c")).toBeCloseTo(5 / 6);
    expect(effectOf(result, "a") + effectOf(result, "b") + effectOf(result, "c")).toBeCloseTo(2);
  });

  it("skips zero-weight candidates and stops when the pool runs out", () => {
    const result = affixOdds(model(entry("a", 1, ["set", 1]), entry("b", 1, ["set", 1], ["multiply", 0])), FLAT, 3);
    expect(effectOf(result, "a")).toBeCloseTo(1);
    expect(effectOf(result, "b")).toBe(0);
  });

  it("gives nothing for zero slots or an empty model", () => {
    expect(affixOdds(model(entry("a", 1, ["set", 1])), FLAT, 0).templates.every(({ probability }) => probability === 0)).toBe(true);
    expect(affixOdds(model(), FLAT, 2).templates).toEqual([]);
  });

  it("uses the tier factors of the threat", () => {
    const entries = model(entry("a", 1, ["set", 1]), entry("a", 2, ["set", 1]), entry("b", 1, ["set", 1]));
    const result = affixOdds(entries, [1, 0, 1], 1);
    expect(templateOf(result, "a", 2)).toBe(0);
    expect(templateOf(result, "a", 1)).toBeCloseTo(0.5);
  });
});

describe("affixOdds on a big pool", () => {
  it("stays fast and keeps the chances adding up to the slots (40 effects, 4 slots)", () => {
    const entries = Array.from({ length: 40 }, (_, index) => entry(`e${index}`, 1, ["set", 1 + (index % 3)]));
    const started = Date.now();
    const result = affixOdds(model(...entries), FLAT, 4);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(result.effects.reduce((sum, found) => sum + found.probability, 0)).toBeCloseTo(4);
  });

  it("never draws more than the most slots an item can have", () => {
    const entries = Array.from({ length: 10 }, (_, index) => entry(`e${index}`, 1, ["set", 1]));
    expect(affixOdds(model(...entries), FLAT, 50).effects.reduce((sum, found) => sum + found.probability, 0)).toBeCloseTo(MAX_SLOTS);
  });
});

describe("affixOdds without the effects an item already has", () => {
  it("drops every tier of them from the pool", () => {
    const result = affixOdds(model(entry("a", 1, ["set", 1]), entry("a", 2, ["set", 1]), entry("b", 1, ["set", 1])), FLAT, 1, ["a"]);
    expect(effectOf(result, "a")).toBe(0);
    expect(effectOf(result, "b")).toBeCloseTo(1);
  });
});

describe("itemOdds", () => {
  const file: AffixFile = {
    levels: [1, 2],
    tierFactors: [[1, 0, 0], [1, 1, 0]],
    models: { m1: model(entry("a", 1, ["set", 1]), entry("a", 2, ["set", 1]), entry("b", 1, ["set", 2]), entry("c", 1, ["set", 1])) },
    items: { sword: { model: "m1", fixed: ["c"], rarities: [{ rarity: "rare", slots: 1, bonusSlots: 1 }] } },
  };

  it("uses the level's tier factors, the rarity's slots and the item's built-in effects", () => {
    const one = itemOdds(file, "sword", { level: 1, rarity: "rare", bonus: false });
    expect(one && effectOf(one, "a")).toBeCloseTo(1 / 3);
    expect(one && templateOf(one, "a", 2)).toBe(0);
    const two = itemOdds(file, "sword", { level: 2, rarity: "rare", bonus: false });
    expect(two && templateOf(two, "a", 2)).toBeCloseTo(1 / 4);
    expect(one && effectOf(one, "c")).toBe(0);
  });

  it("adds the bonus slot only when asked", () => {
    const base = itemOdds(file, "sword", { level: 1, rarity: "rare", bonus: false });
    const bonus = itemOdds(file, "sword", { level: 1, rarity: "rare", bonus: true });
    expect(base && effectOf(base, "a")).toBeCloseTo(1 / 3);
    expect(bonus && effectOf(bonus, "a")).toBeCloseTo(1);
  });

  it("answers nothing for an unknown item, level or rarity", () => {
    expect(itemOdds(file, "axe", { level: 1, rarity: "rare", bonus: false })).toBeUndefined();
    expect(itemOdds(file, "sword", { level: 9, rarity: "rare", bonus: false })).toBeUndefined();
    expect(itemOdds(file, "sword", { level: 1, rarity: "unique", bonus: false })).toBeUndefined();
    expect(itemOdds(file, "constructor", { level: 1, rarity: "rare", bonus: false })).toBeUndefined();
  });
});

describe("formatOdds", () => {
  it("prints two decimals, small values as <0.01% and none as 0%", () => {
    expect(formatOdds(0.123966941904)).toBe("12.40%");
    expect(formatOdds(0.00006)).toBe("<0.01%");
    expect(formatOdds(0.0001)).toBe("0.01%");
    expect(formatOdds(0)).toBe("0%");
    expect(formatOdds(1)).toBe("100.00%");
  });
});
