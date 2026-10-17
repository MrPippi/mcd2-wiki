import { describe, expect, it } from "vitest";
import { itemRows, MAX_DRAWS, profileOdds, slotOdds } from "../../../src/lib/drop-odds";
import { rarityShares, rarityWeights } from "../../../src/lib/drop-rarity";
import type { DropFile, DropItem, DropSlot } from "../../../src/lib/drop-types";

// Items: 0 A and 1 B share a history group, 2 C is alone, 3 is a currency the site has no page for, 4 Z is the unique variant of A.
const ITEMS: DropItem[] = [
  { key: "melee/a", group: "x", sub: 4 },
  { key: "melee/b", group: "x" },
  { key: "artifact/c", group: "y" },
  { key: "~springstone", group: "~springstone", opaque: true },
  { key: "melee/z", group: "z", unique: true },
];
const FLAT: [number, number, number, number] = [1, 1, 1, 1];
const NORMAL = { level: 1, difficulty: "normal", rarity: "any" } as const;
const NONE = rarityShares([0, 0, 0, 0]);
const slot = (over: Partial<DropSlot> = {}): DropSlot => ({ slot: "item", guaranteed: 1, rolls: 0, chance: 0, pool: "p", ...over });
const file = (over: Partial<DropFile> = {}): DropFile => ({
  levels: [1],
  rarityFactors: [FLAT],
  difficulties: { normal: [] },
  slots: {
    item: { history: 3, oneOfAKind: false },
    specialgear: { history: 0, oneOfAKind: false },
    talismans: { history: 0, oneOfAKind: true },
  },
  items: ITEMS,
  pools: { p: [[0, 1], [1, 1], [2, 2]] },
  profiles: { q: { slots: [slot()], rarity: [] } },
  sources: [],
  ...over,
});
const odds = (over: Partial<DropSlot>, target: number, pool: [number, number][] = [[0, 1], [1, 1], [2, 2]], shares = NONE) =>
  slotOdds(file(), slot(over), pool, target, { shares, rarity: "any" });

describe("rarityWeights", () => {
  it("takes the largest Set, sums Add, multiplies Multiply, each scaled once by the threat factor", () => {
    expect(rarityWeights([[1, "s", 25], [1, "s", 10]], [1, 0.5, 1, 1])).toEqual([0, 12.5, 0, 0]);
    expect(rarityWeights([[1, "s", 25], [1, "a", 5]], [1, 0.5, 1, 1])[1]).toBe(15);
    // Rare 25 with Multiply 0.01 at factor 0.5: (25 * 0.5) * (0.01 * 0.5), as in the Soul Storm reward chest.
    expect(rarityWeights([[1, "s", 25], [1, "m", 0.01]], [1, 0.5, 1, 1])[1]).toBeCloseTo(0.0625);
    expect(rarityWeights([[0, "s", 50], [0, "m", 0]], FLAT)[0]).toBe(0);
  });

  it("is never below zero and has no weight without a Set or Add entry", () => {
    expect(rarityWeights([[2, "m", 0.5]], FLAT)[2]).toBe(0);
    expect(rarityWeights([[2, "s", 1], [2, "a", -4]], FLAT)[2]).toBe(0);
  });
});

describe("rarityShares", () => {
  it("normalizes the four weights", () => {
    expect(rarityShares([25, 12.5, 20, 5])).toEqual({ common: 25 / 62.5, rare: 12.5 / 62.5, special: 20 / 62.5, unique: 5 / 62.5 });
  });

  it("makes every roll Common when all weights are zero", () => {
    expect(rarityShares([0, 0, 0, 0])).toEqual({ common: 1, rare: 0, special: 0, unique: 0 });
  });
});

describe("slotOdds", () => {
  it("is the weight share for one guaranteed draw", () => {
    expect(odds({}, 0)).toBeCloseTo(0.25);
    expect(odds({}, 2)).toBeCloseTo(0.5);
  });

  it("is 0 for an item outside the pool", () => {
    expect(odds({}, 3)).toBe(0);
  });

  it("covers random rolls with the binomial number of successes", () => {
    // Two rolls at 50% and one pool entry: at least one roll succeeds with 0.75.
    expect(odds({ guaranteed: 0, rolls: 2, chance: 0.5 }, 0, [[0, 1]])).toBeCloseTo(0.75);
  });

  it("blocks the group of a recent drop: A and B share one, so the second draw can only be C", () => {
    expect(odds({ guaranteed: 2 }, 2)).toBeCloseTo(1);
    // A is drawn first (1/4), or after C (1/2 * 1/2); after B it is blocked.
    expect(odds({ guaranteed: 2 }, 0)).toBeCloseTo(0.5);
  });

  it("stops drawing when every item is blocked", () => {
    expect(odds({ guaranteed: 3 }, 0, [[0, 1], [1, 1]])).toBeCloseTo(0.5);
  });

  it("does not repeat an item a one-of-a-kind slot already gave", () => {
    expect(odds({ slot: "talismans", guaranteed: 2 }, 0, [[0, 1], [1, 1]])).toBeCloseTo(1);
  });

  it("lets a slot without history draw the same item again", () => {
    expect(odds({ slot: "specialgear", guaranteed: 2 }, 0, [[0, 1], [1, 1]])).toBeCloseTo(0.75);
  });

  it("follows at most MAX_DRAWS draws", () => {
    expect(odds({ slot: "specialgear", guaranteed: MAX_DRAWS + 5 }, 0, [[0, 1], [1, 1]])).toBeCloseTo(1 - 0.5 ** MAX_DRAWS);
  });

  it("counts a base item only when its roll is not Unique, and the unique variant only when it is", () => {
    const half = rarityShares([0, 0, 1, 1]);
    expect(odds({}, 0, [[0, 1]], half)).toBeCloseTo(0.5);
    expect(odds({}, 4, [[0, 1]], half)).toBeCloseTo(0.5);
  });

  it("gives a unique item picked directly a hit of 1", () => {
    expect(odds({}, 4, [[4, 1]])).toBe(1);
  });

  it("keeps the weight of a currency in the pool without ever hitting it", () => {
    expect(odds({}, 0, [[0, 1], [3, 3]])).toBeCloseTo(0.25);
  });

  it("filters by target rarity", () => {
    const rolls = rarityShares([1, 1, 2, 0]);
    const by = (rarity: "common" | "rare" | "special" | "unique", target = 0) => slotOdds(file(), slot(), [[0, 1]], target, { shares: rolls, rarity });
    expect(by("rare")).toBeCloseTo(0.25);
    expect(by("special")).toBeCloseTo(0.5);
    expect(by("unique", 0)).toBe(0);
    expect(by("rare", 2)).toBe(0);
  });
});

describe("profileOdds", () => {
  it("combines slots as 1 - product of the misses", () => {
    const f = file({
      pools: { p: [[0, 1], [1, 1]], r: [[0, 1]] },
      profiles: { q: { slots: [slot(), slot({ slot: "specialgear", pool: "r" })], rarity: [] } },
    });
    expect(profileOdds(f, f.profiles.q, 0, NORMAL)).toBeCloseTo(1);
    expect(profileOdds(f, f.profiles.q, 1, NORMAL)).toBeCloseTo(0.5);
  });

  it("applies the threat factors and the difficulty row to the rarity", () => {
    const f = file({
      levels: [1, 2],
      rarityFactors: [FLAT, [1, 1, 1, 0]],
      difficulties: { normal: [], low: [[3, "m", 0]] },
      pools: { u: [[0, 1]] },
      profiles: { q: { slots: [slot({ pool: "u" })], rarity: [[0, "s", 1], [1, "s", 1], [3, "s", 2]] } },
    });
    const at = (target: number, level: number, difficulty: string) => profileOdds(f, f.profiles.q, target, { level, difficulty, rarity: "any" });
    // Level 1: weights 1, 1, 0, 2 -> Unique is 1/2, so base item A and its variant Z are each hit half the time.
    expect(at(0, 1, "normal")).toBeCloseTo(0.5);
    expect(at(4, 1, "normal")).toBeCloseTo(0.5);
    // Level 2 has no Unique weight at all.
    expect(at(4, 2, "normal")).toBe(0);
    expect(at(0, 2, "normal")).toBeCloseTo(1);
    // The Low difficulty row multiplies Unique by 0.
    expect(at(4, 1, "low")).toBe(0);
    expect(at(0, 1, "low")).toBeCloseTo(1);
  });
});

describe("itemRows", () => {
  const f = file({
    pools: { p: [[0, 1], [1, 1]], r: [[0, 3], [1, 1]] },
    profiles: { q: { slots: [slot()], rarity: [] }, w: { slots: [slot({ pool: "r" })], rarity: [] } },
    sources: [
      { id: "chest:One", kind: "chest", contexts: [["area:Plains", "q"], ["area:Forest", "w"]] },
      { id: "chest:Two", kind: "chest", contexts: [["", "q"]] },
    ],
  });

  it("lists every source and area that can give the item, best first, leaving out the impossible", () => {
    const rows = itemRows(f, "melee/a", NORMAL);
    expect(rows.map((row) => [row.source, row.area, Number(row.probability.toFixed(2))])).toEqual([
      ["chest:One", "area:Forest", 0.75],
      ["chest:One", "area:Plains", 0.5],
      ["chest:Two", "", 0.5],
    ]);
    expect(itemRows(f, "artifact/c", NORMAL)).toEqual([]);
  });

  it("is empty for an item, a threat level or a difficulty the file does not know", () => {
    expect(itemRows(f, "melee/none", NORMAL)).toEqual([]);
    expect(itemRows(f, "melee/a", { ...NORMAL, level: 9 })).toEqual([]);
    expect(itemRows(f, "melee/a", { ...NORMAL, difficulty: "nightmare" })).toEqual([]);
  });
});
