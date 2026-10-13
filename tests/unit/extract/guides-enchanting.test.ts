import { describe, expect, it } from "vitest";
import { buildEnchantCosts, maxEnchantmentLevel, rarityOfTag } from "../../../scripts/extract/guides-enchanting";
import { guideTables, playerRow } from "../../helpers/guide-tables";

describe("rarityOfTag", () => {
  it("maps the four rarity tags, ignoring case, and nothing else", () => {
    expect(rarityOfTag("SW.Rarity.Special")).toBe("special");
    expect(rarityOfTag("sw.rarity.unique")).toBe("unique");
    expect(rarityOfTag("SW.Rarity.Base")).toBeUndefined();
  });
});

describe("buildEnchantCosts", () => {
  it("reads base and per-level costs for every rarity, lowest first", () => {
    const { costs, issues } = buildEnchantCosts(guideTables());
    expect(costs).toEqual([
      { rarity: "common", points: 1, pointsPerLevel: 1, shards: 1, shardsPerLevel: 0 },
      { rarity: "rare", points: 1, pointsPerLevel: 2, shards: 1, shardsPerLevel: 0 },
      { rarity: "special", points: 2, pointsPerLevel: 2, shards: 1, shardsPerLevel: 0 },
      { rarity: "unique", points: 3, pointsPerLevel: 2, shards: 1, shardsPerLevel: 0 },
    ]);
    expect(issues).toEqual([]);
  });

  it("reports each rarity the cost map lacks", () => {
    const player = playerRow();
    const tables = guideTables({ player: [{ ...player, Abilities: player.Abilities.slice(2) }] });
    const { costs, issues } = buildEnchantCosts(tables);
    expect(costs).toEqual([]);
    expect(issues).toHaveLength(4);
  });

  it("skips map keys that are not rarities", () => {
    const player = playerRow();
    const enchant = player.Abilities[1];
    const map = { '(TagName="SW.Rarity.Base")': { SpringStoneCost: 9, SpringStoneAdditionalCostPerLevel: 0, EnchantmentPointCost: 9, EnchantmentPointAdditionalCostPerLevel: 0 } };
    const tables = guideTables({ player: [{ ...player, Abilities: [{ ...enchant, InstanceData: [{ EnchantCostMap: map }] }] }] });
    expect(buildEnchantCosts(tables).costs).toEqual([]);
  });
});

describe("maxEnchantmentLevel", () => {
  it("is the highest level suffix any enchantment carries", () => {
    expect(maxEnchantmentLevel(guideTables())).toEqual({ maxLevel: 3, issues: [] });
  });
  it("is 0, reported, when no enchantment has a level", () => {
    const { maxLevel, issues } = maxEnchantmentLevel(guideTables({ enchantments: [{ Name: "Burning", TypeTag: { TagName: "SW.Enchantment.Burning" } }] }));
    expect(maxLevel).toBe(0);
    expect(issues[0]?.type).toBe("guides-value-missing");
  });
});
