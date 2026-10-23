import { describe, expect, it } from "vitest";
import type { SoulFamily } from "../../../shared/soul-enchantment-schema";
import { familyRows, formatModifier, levelBonuses, soulEnchantmentData } from "../../../src/lib/soul-enchantments";
import { loc } from "../../helpers/localized";

const family = (tiers: SoulFamily["tiers"]): SoulFamily => ({
  id: "Test", slug: "test", name: loc({ zh: "測試", en: "Test" }), untranslated: [], tiers, excludedMobs: [], excludedQuests: [],
});

describe("formatModifier", () => {
  it("prints multipliers, signed additions and chances", () => {
    expect(formatModifier({ attribute: "healthMax", op: "multiply", value: 1.2 }, "en")).toBe("×1.2");
    expect(formatModifier({ attribute: "resistPoison", op: "add", value: -0.66 }, "en")).toBe("−0.66");
    expect(formatModifier({ attribute: "projectileDeflectChance", op: "add", value: 0.33 }, "en")).toBe("+33%");
  });
});

describe("familyRows", () => {
  const rows = familyRows(
    family([
      { tier: "I", threat: { min: 3, max: 20 }, modifiers: [{ attribute: "healthMax", op: "multiply", value: 1.2 }, { attribute: "resistTnt", op: "multiply", value: 2 }], ability: [{ key: "blastRange", value: 5 }] },
      { tier: "II", threat: { min: 0, max: 20 }, modifiers: [{ attribute: "healthMax", op: "multiply", value: 1.4 }], ability: [{ key: "blastRange", value: 5.5 }] },
      { tier: "III", threat: { min: 0, max: 20 }, modifiers: [{ attribute: "healthMax", op: "multiply", value: 1.6 }], ability: [{ key: "swiftnessChance", value: 0.5 }] },
    ]),
    "en",
  );

  it("makes one row per stat in first-seen order, with a column per tier and gaps where a tier lacks it", () => {
    expect(rows.map((row) => row.id)).toEqual(["attr:healthMax:multiply", "attr:resistTnt:multiply", "ability:blastRange", "ability:swiftnessChance", "threat"]);
    expect(rows[0]).toEqual({ id: "attr:healthMax:multiply", label: "Max health", values: ["×1.2", "×1.4", "×1.6"] });
    expect(rows[1].values).toEqual(["×2", undefined, undefined]);
    expect(rows[2].values).toEqual(["5 blocks", "5.5 blocks", undefined]);
    expect(rows[3].values).toEqual([undefined, undefined, "50%"]);
    expect(rows[4].values).toEqual(["3–20", "0–20", "0–20"]);
  });

  it("leaves the threat row out when every tier spans the full range, and labels in the page language", () => {
    const plain = familyRows(family([{ tier: "I", threat: { min: 0, max: 20 }, modifiers: [{ attribute: "resistTnt", op: "multiply", value: 2 }], ability: [] }]), "zh");
    expect(plain.map((row) => row.id)).toEqual(["attr:resistTnt:multiply"]);
    expect(plain[0].label).toBe("TNT 抗性倍率");
  });
});

describe("soul enchantment site data", () => {
  it("has the twelve families with an icon and three tiers each, and the generic level rows", () => {
    expect(soulEnchantmentData.families).toHaveLength(12);
    for (const one of soulEnchantmentData.families) {
      expect(one.icon, one.slug).toMatch(/^icons\/soul-enchantments\/[a-z-]+\.png$/);
      expect(one.tiers.map((tier) => tier.tier), one.slug).toEqual(["I", "II", "III"]);
      expect(familyRows(one, "en").length, one.slug).toBeGreaterThan(0);
    }
    expect(levelBonuses(soulEnchantmentData, "en")).toBe("I Max health ×1.25 · II Max health ×1.5 · III Max health ×2");
  });
});
