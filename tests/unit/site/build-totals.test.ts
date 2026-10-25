import { describe, expect, it } from "vitest";
import type { BuildPayload } from "../../../src/lib/build/parse";
import { buildTotals, sumMagnitudes } from "../../../src/lib/build/totals";

const PERCENT = { percent: true, multiplier: 1, offset: 0, maxFractionDigits: 2 };
const option = (slug: string, extra: Record<string, unknown> = {}) => ({ slug, name: slug, search: slug, href: `/en/x/${slug}/`, ...extra });

// Two effects (sharpness, health boost) shared by every item; the sword and the helmet roll sharpness with different tiers.
const PAYLOAD = {
  effects: [option("sharpness", { format: PERCENT }), option("health-boost", { format: { ...PERCENT, offset: -1 } })],
  tierSets: [[0.1, 0.2, 0.3], [0.05, 0.1, 0.15], [1.1, 1.2, 1.3]],
  pools: {
    melee: [option("sword", { effects: [0], effectTiers: [0] }), option("blade", { effects: [0], effectTiers: [0], fixed: { name: "hb", href: "/hb/", effect: true, index: 1, value: 1.1 } })],
    ranged: [], chest: [], leggings: [], boots: [], artifact: [], talisman: [],
    helmet: [option("cap", { effects: [0, 1], effectTiers: [1, 2] })],
  },
  enchantments: [option("fire-aspect", { slots: ["melee"], tiers: [["35%"], ["45%"], ["50%"]] })],
} as unknown as BuildPayload;

describe("sumMagnitudes", () => {
  it("adds the printed values: scale and offset apply to each item", () => {
    expect(sumMagnitudes([0.1, 0.05], PERCENT)).toBe("15%");
    expect(sumMagnitudes([1.1, 1.2], { ...PERCENT, offset: -1 })).toBe("30%");
    expect(sumMagnitudes([-0.1, -0.15], { ...PERCENT, multiplier: -1 })).toBe("25%");
    expect(sumMagnitudes([2, 3], undefined)).toBe("5");
  });
});

describe("buildTotals", () => {
  it("lists each effect once with its slots, and totals an effect on several items", () => {
    const totals = buildTotals(
      PAYLOAD,
      { melee: "sword", helmet: "cap" },
      { melee: [{ slug: "sharpness", tier: 3 }], helmet: [{ slug: "sharpness", tier: 1 }, { slug: "health-boost", tier: 2 }] },
      {},
    );
    expect(totals.effects.map((row) => [row.slug, row.sum])).toEqual([["sharpness", "35%"], ["health-boost", undefined]]);
    expect(totals.effects[0]!.parts).toEqual([
      { slot: "melee", tier: 3, value: "30%" },
      { slot: "helmet", tier: 1, value: "5%" },
    ]);
    expect(totals.effects[1]!.parts).toEqual([{ slot: "helmet", tier: 2, value: "20%" }]);
  });

  it("counts a unique item's built-in effect", () => {
    const totals = buildTotals(PAYLOAD, { melee: "blade", helmet: "cap" }, { helmet: [{ slug: "health-boost", tier: 3 }] }, {});
    expect(totals.effects).toEqual([
      expect.objectContaining({ slug: "health-boost", sum: "40%", parts: [{ slot: "melee", builtIn: true, value: "10%" }, { slot: "helmet", tier: 3, value: "30%" }] }),
    ]);
  });

  it("lists enchantments with their tier values, and skips one whose slot is empty", () => {
    expect(buildTotals(PAYLOAD, { melee: "sword" }, {}, { melee: { slug: "fire-aspect", tier: 2 } }).enchants).toEqual([
      expect.objectContaining({ slug: "fire-aspect", parts: [{ slot: "melee", tier: 2, value: "45%" }] }),
    ]);
    expect(buildTotals(PAYLOAD, {}, {}, { melee: { slug: "fire-aspect", tier: 2 } }).enchants).toEqual([]);
  });

  it("is empty for an empty build", () => {
    expect(buildTotals(PAYLOAD, {}, {}, {})).toEqual({ effects: [], enchants: [] });
  });
});
