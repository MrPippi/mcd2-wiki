import { describe, expect, it } from "vitest";
import { buildCaps, buildMerchant, buildVendors, mapKeyTag } from "../../../scripts/extract/guides-vendors";
import { guideTables, merchantRow, playerRow } from "../../helpers/guide-tables";

describe("mapKeyTag", () => {
  it("reads the tag out of an exported map key and leaves other keys alone", () => {
    expect(mapKeyTag('(TagName="SW.NPC.Enchantsmith")')).toBe("SW.NPC.Enchantsmith");
    expect(mapKeyTag("SW.NPC.Enchantsmith")).toBe("SW.NPC.Enchantsmith");
  });
});

describe("buildVendors", () => {
  it("prices each vendor's levels 2 and 3 in a fixed vendor order", () => {
    const { vendors, issues } = buildVendors(guideTables());
    expect(vendors).toEqual([
      { id: "merchant", levels: [{ level: 2, cost: 10 }, { level: 3, cost: 15 }] },
      { id: "blacksmith", levels: [{ level: 2, cost: 20 }, { level: 3, cost: 40 }] },
      { id: "enchantsmith", levels: [{ level: 2, cost: 30 }, { level: 3, cost: 60 }] },
    ]);
    expect(issues).toEqual([]);
  });

  it("leaves out a vendor the upgrade map lacks and skips, reporting them, level keys that are not 2 or higher", () => {
    const player = playerRow();
    const upgrade = player.Abilities[2].InstanceData[0] as { UpgradeCosts: Record<string, { LevelToCostMap: Record<string, number> }> };
    const costs = { '(TagName="SW.NPC.VillageMerchant")': { LevelToCostMap: { "3": 15, "1": 0, "x": 5, "2": 10 } } };
    const tables = guideTables({ player: [{ ...player, Abilities: [{ ...player.Abilities[2], InstanceData: [{ ...upgrade, UpgradeCosts: costs }] }] }] });
    const { vendors, issues } = buildVendors(tables);
    expect(vendors).toEqual([{ id: "merchant", levels: [{ level: 2, cost: 10 }, { level: 3, cost: 15 }] }]);
    expect(issues.map((item) => item.detail)).toEqual([
      "GA_UpgradeMerchant SW.NPC.VillageMerchant: level keys skipped (1, x)",
      "GA_UpgradeMerchant UpgradeCosts: SW.NPC.OldBlacksmith",
      "GA_UpgradeMerchant UpgradeCosts: SW.NPC.Enchantsmith",
    ]);
  });

  it("has no vendors without DefaultPlayer", () => {
    expect(buildVendors(guideTables({ player: [] })).vendors).toEqual([]);
  });
});

describe("buildCaps", () => {
  it("reads the Emerald, Echo Shard and level caps", () => {
    expect(buildCaps(guideTables())).toEqual({ caps: { emeralds: 99999, echoShards: 100, level: 100 }, issues: [] });
  });

  it("gives no caps and an issue when one is missing", () => {
    const player = { ...playerRow(), AttributeValues: playerRow().AttributeValues.slice(0, 2) };
    const result = buildCaps(guideTables({ player: [player] }));
    expect(result.caps).toBeNull();
    expect(result.issues[0]?.type).toBe("guides-value-missing");
  });
});

describe("buildMerchant", () => {
  it("reads stock size, refresh cost, base prices per gear type and the rarity multipliers", () => {
    const { merchant, issues } = buildMerchant(guideTables());
    expect(merchant?.slotsPerRarity).toBe(3);
    expect(merchant?.refreshCost).toBe(3);
    expect(merchant?.basePrices.map((row) => row.gear)).toEqual(["melee", "ranged", "helmet", "chest", "leggings", "boots", "artifact"]);
    expect(merchant?.basePrices.every((row) => row.price === 20)).toBe(true);
    expect(merchant?.multipliers).toEqual([{ rarity: "rare", value: 2 }, { rarity: "special", value: 3 }, { rarity: "unique", value: 4 }]);
    expect(issues).toEqual([]);
  });

  it("gives no merchant when a key value is missing", () => {
    const row = merchantRow();
    const result = buildMerchant(guideTables({ npcs: [{ ...row, KeyValues: row.KeyValues.filter((keyValue) => !keyValue.TypeTag.TagName.endsWith("RefreshCost")) }] }));
    expect(result.merchant).toBeNull();
    expect(result.issues).toHaveLength(1);
  });

  it("gives no merchant when a base price is missing or the row is absent", () => {
    const row = merchantRow();
    expect(buildMerchant(guideTables({ npcs: [{ ...row, KeyValues: row.KeyValues.slice(1) }] })).merchant).toBeNull();
    expect(buildMerchant(guideTables({ npcs: [] })).merchant).toBeNull();
  });
});
