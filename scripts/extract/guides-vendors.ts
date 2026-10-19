/**
 * Town vendors and the player's caps, from DT_PlayerDefinition (DefaultPlayer) and DT_NPCDefinition.
 * GA_UpgradeMerchant's VendorUpgradeDefinition prices each vendor level; the Town Merchant's KeyValues hold its stock and prices.
 */
import type { GearType, GuidesData, MerchantData, Rarity, Vendor, VendorData } from "../../shared/guides-schema";
import type { GuideTables, PlayerRow } from "./guides-tables";
import { issue, type Issue } from "./issues";

const DEFAULT_PLAYER = "DefaultPlayer";
const UPGRADE_ABILITY = "/Script/InventorySystem.GA_UpgradeMerchant";
const MERCHANT_ROW = "VillageMerchant";

/** The NPC tag each vendor's upgrade costs are keyed by. */
const VENDOR_TAGS: Readonly<Record<Vendor, string>> = {
  merchant: "SW.NPC.VillageMerchant",
  blacksmith: "SW.NPC.OldBlacksmith",
  enchantsmith: "SW.NPC.Enchantsmith",
};

const CAP_ATTRIBUTES = {
  emeralds: "SW.Attribute.EmeraldsMax",
  echoShards: "SW.Attribute.SpringStoneMax",
  level: "SW.Attribute.LevelMax",
} as const;

const GEAR_KEYS: Readonly<Record<GearType, string>> = {
  melee: "MeleeWeapon",
  ranged: "RangedWeapon",
  helmet: "Helmet",
  chest: "Chest",
  leggings: "Leggings",
  boots: "Boots",
  artifact: "Artifact",
};

const MULTIPLIER_KEYS: Readonly<Partial<Record<Rarity, string>>> = { rare: "RareCostMultiplier", special: "SpecialCostMultiplier", unique: "UniqueCostMultiplier" };

/** `(TagName="SW.X")` map keys → SW.X. */
export const mapKeyTag = (key: string): string => /^\(TagName="([^"]+)"\)$/.exec(key)?.[1] ?? key;

export const defaultPlayer = (tables: GuideTables): PlayerRow | undefined => tables.player.find((row) => row.Name === DEFAULT_PLAYER);

/** The instance data of one of DefaultPlayer's abilities, by class path. */
export const abilityData = (player: PlayerRow | undefined, ability: string) =>
  player?.Abilities?.find((entry) => entry.Ability === ability)?.InstanceData ?? [];

export function buildCaps(tables: GuideTables): { caps: GuidesData["caps"]; issues: Issue[] } {
  const attributes = defaultPlayer(tables)?.AttributeValues ?? [];
  const value = (tag: string) => attributes.find((attribute) => attribute.Attribute.TagName === tag)?.Value;
  const [emeralds, echoShards, level] = [value(CAP_ATTRIBUTES.emeralds), value(CAP_ATTRIBUTES.echoShards), value(CAP_ATTRIBUTES.level)];
  if (emeralds === undefined || echoShards === undefined || level === undefined) {
    return { caps: null, issues: [issue("guides-value-missing", `${DEFAULT_PLAYER} AttributeValues: ${Object.values(CAP_ATTRIBUTES).join(", ")}`)] };
  }
  return { caps: { emeralds, echoShards, level }, issues: [] };
}

function vendorOf(id: Vendor, costs: Readonly<Record<string, { LevelToCostMap: Record<string, number> }>>): { vendor?: VendorData; issues: Issue[] } {
  const entry = Object.entries(costs).find(([key]) => mapKeyTag(key) === VENDOR_TAGS[id]);
  if (!entry) return { issues: [issue("guides-value-missing", `GA_UpgradeMerchant UpgradeCosts: ${VENDOR_TAGS[id]}`)] };
  const all = Object.entries(entry[1].LevelToCostMap).map(([key, cost]) => ({ key, level: Number(key), cost }));
  const valid = (level: number): boolean => Number.isInteger(level) && level >= 2;
  const levels = all.filter(({ level }) => valid(level)).map(({ level, cost }) => ({ level, cost })).sort((a, b) => a.level - b.level);
  const dropped = all.filter(({ level }) => !valid(level)).map(({ key }) => key);
  return {
    vendor: { id, levels },
    issues: dropped.length > 0 ? [issue("guides-value-missing", `GA_UpgradeMerchant ${VENDOR_TAGS[id]}: level keys skipped (${dropped.join(", ")})`)] : [],
  };
}

/** The three town vendors in a fixed order; a vendor the upgrade map lacks is left out and reported. */
export function buildVendors(tables: GuideTables): { vendors: VendorData[]; issues: Issue[] } {
  const costs = abilityData(defaultPlayer(tables), UPGRADE_ABILITY).find((data) => data.UpgradeCosts)?.UpgradeCosts ?? {};
  const built = (Object.keys(VENDOR_TAGS) as Vendor[]).map((id) => vendorOf(id, costs));
  return {
    vendors: built.flatMap(({ vendor }) => (vendor ? [vendor] : [])),
    issues: built.flatMap((one) => one.issues),
  };
}

/** The Town Merchant's stock and prices; null (with an issue) when any of its KeyValues is missing. */
export function buildMerchant(tables: GuideTables): { merchant: MerchantData | null; issues: Issue[] } {
  const keyValues = tables.npcs.find((row) => row.Name === MERCHANT_ROW)?.KeyValues ?? [];
  const value = (name: string) => {
    const found = keyValues.find((keyValue) => keyValue.TypeTag.TagName === `SW.KeyValue.${name}`);
    return found?.Int ?? found?.Float;
  };
  const basePrices = (Object.keys(GEAR_KEYS) as GearType[]).flatMap((gear) => {
    const price = value(`BaseCost.${GEAR_KEYS[gear]}`);
    return price === undefined ? [] : [{ gear, price }];
  });
  const multipliers = (Object.entries(MULTIPLIER_KEYS) as [Rarity, string][]).flatMap(([rarity, key]) => {
    const multiplier = value(key);
    return multiplier === undefined ? [] : [{ rarity, value: multiplier }];
  });
  const slotsPerRarity = value("SlotsPerRarity");
  const refreshCost = value("RefreshCost");
  const complete = basePrices.length === Object.keys(GEAR_KEYS).length && multipliers.length === Object.keys(MULTIPLIER_KEYS).length;
  if (!complete || slotsPerRarity === undefined || refreshCost === undefined) {
    return { merchant: null, issues: [issue("guides-value-missing", `DT_NPCDefinition ${MERCHANT_ROW} KeyValues`)] };
  }
  return {
    merchant: { slotsPerRarity, refreshCost, basePrices, multipliers },
    issues: [],
  };
}
