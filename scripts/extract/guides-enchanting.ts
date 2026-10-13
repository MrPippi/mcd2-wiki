/** Enchanting costs (DefaultPlayer GA_ItemEnchant EnchantCostMap) and the highest enchantment level the enchantment table defines. */
import type { EnchantCost, Rarity } from "./guides-schema";
import type { GuideTables } from "./guides-tables";
import { abilityData, defaultPlayer, mapKeyTag } from "./guides-vendors";
import { issue, type Issue } from "./issues";

const ENCHANT_ABILITY = "/Script/InventorySystem.GA_ItemEnchant";
const RARITY_TAGS: Readonly<Record<Rarity, string>> = {
  common: "SW.Rarity.Common",
  rare: "SW.Rarity.Rare",
  special: "SW.Rarity.Special",
  unique: "SW.Rarity.Unique",
};
/** Enchantment level suffixes (SW.Enchantment.<Name>.III), lowest first. */
const LEVELS = ["I", "II", "III", "IV", "V"] as const;

export const rarityOfTag = (tag: string): Rarity | undefined =>
  (Object.keys(RARITY_TAGS) as Rarity[]).find((rarity) => RARITY_TAGS[rarity].toLowerCase() === tag.toLowerCase());

/** Cost per rarity, lowest rarity first; a rarity the map lacks is reported. */
export function buildEnchantCosts(tables: GuideTables): { costs: EnchantCost[]; issues: Issue[] } {
  const map = abilityData(defaultPlayer(tables), ENCHANT_ABILITY).find((data) => data.EnchantCostMap)?.EnchantCostMap ?? {};
  const byRarity = new Map(Object.entries(map).flatMap(([key, cost]) => {
    const rarity = rarityOfTag(mapKeyTag(key));
    return rarity ? [[rarity, cost] as const] : [];
  }));
  const rarities = Object.keys(RARITY_TAGS) as Rarity[];
  const costs = rarities.flatMap((rarity) => {
    const cost = byRarity.get(rarity);
    return cost
      ? [{
          rarity,
          points: cost.EnchantmentPointCost,
          pointsPerLevel: cost.EnchantmentPointAdditionalCostPerLevel,
          shards: cost.SpringStoneCost,
          shardsPerLevel: cost.SpringStoneAdditionalCostPerLevel,
        }]
      : [];
  });
  const missing = rarities.filter((rarity) => !byRarity.has(rarity));
  return { costs, issues: missing.map((rarity) => issue("guides-value-missing", `GA_ItemEnchant EnchantCostMap: ${RARITY_TAGS[rarity]}`)) };
}

/** The highest level suffix any enchantment row carries (3 for .III); 0, reported, when none does. */
export function maxEnchantmentLevel(tables: GuideTables): { maxLevel: number; issues: Issue[] } {
  const levels = tables.enchantments.map((row) => LEVELS.indexOf(row.TypeTag.TagName.split(".").at(-1) as (typeof LEVELS)[number]) + 1);
  const maxLevel = Math.max(0, ...levels);
  return { maxLevel, issues: maxLevel === 0 ? [issue("guides-value-missing", "DT_EnchantmentDefinition: no row has a level suffix (.I/.II/.III)")] : [] };
}
