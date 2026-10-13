import { describe, expect, it } from "vitest";
import { buildDropWeights, buildRarityTiers } from "../../../scripts/extract/guides-rarity";
import { guideTables, rarityChanceRows, rarityRows } from "../../helpers/guide-tables";

describe("buildRarityTiers", () => {
  it("reads rerollable effects, the Soul Storm extra effect and the item power offset per rarity", () => {
    const { tiers, issues } = buildRarityTiers(guideTables());
    expect(tiers).toEqual([
      { rarity: "common", rerollableEffects: 0, stormExtraEffects: null, itemPowerOffset: -2 },
      { rarity: "rare", rerollableEffects: 1, stormExtraEffects: 1, itemPowerOffset: -2 },
      { rarity: "special", rerollableEffects: 2, stormExtraEffects: 1, itemPowerOffset: -1 },
      { rarity: "unique", rerollableEffects: 1, stormExtraEffects: 1, itemPowerOffset: 0 },
    ]);
    expect(issues).toEqual([]);
  });

  it("reports a missing rarity row", () => {
    const { tiers, issues } = buildRarityTiers(guideTables({ rarity: rarityRows().slice(0, 3) }));
    expect(tiers.map((tier) => tier.rarity)).toEqual(["common", "rare"]);
    expect(issues.map((item) => item.detail)).toEqual(["DT_RarityDefinition: special", "DT_RarityDefinition: unique"]);
  });
});

describe("buildDropWeights", () => {
  it("reads the Default and Boss rows with their operations", () => {
    const { drops, issues } = buildDropWeights(guideTables());
    expect(drops).toEqual([
      { source: "default", weights: [
        { rarity: "common", weight: 50, operation: "set" }, { rarity: "rare", weight: 25, operation: "set" },
        { rarity: "special", weight: 20, operation: "set" }, { rarity: "unique", weight: 5, operation: "set" },
      ] },
      { source: "boss", weights: [
        { rarity: "common", weight: 0, operation: "multiply" }, { rarity: "rare", weight: 30, operation: "set" },
        { rarity: "special", weight: 20, operation: "set" }, { rarity: "unique", weight: 10, operation: "set" },
      ] },
    ]);
    expect(issues).toEqual([]);
  });

  it("skips and reports an operation it cannot name, and a missing row", () => {
    const [defaults] = rarityChanceRows();
    const odd = { ...defaults, TagList: { Tags: [{ TypeTag: { TagName: "SW.Rarity.Common" }, Weight: 5, Operation: "Add" }, { TypeTag: { TagName: "SW.Other" }, Weight: 1, Operation: "Set" }] } };
    const { drops, issues } = buildDropWeights(guideTables({ rarityChance: [odd] }));
    expect(drops).toEqual([{ source: "default", weights: [] }]);
    expect(issues.map((item) => item.detail)).toEqual(["Default: SW.Rarity.Common Add", "DT_RarityChanceDefinition: Boss"]);
  });
});
