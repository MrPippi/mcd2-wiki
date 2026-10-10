import type { Entry } from "../../scripts/extract/schemas";
import type { UiKey } from "./i18n";

/** The game's four rarity tiers (SW.Rarity.*), lowest first. */
export type RarityTier = "common" | "rare" | "special" | "unique";

const NON_UNIQUE_TIERS: readonly RarityTier[] = ["common", "rare", "special"];

/**
 * Tiers to show for an entry. Per the official wiki, "every item can be common, rare, or special" (the tier
 * is not fixed per item, so all three are listed) and "unique variants signify a distinct form of the item
 * with its own name and appearance"; the game tags those SW.Rarity.Unique, a tier of its own.
 */
export const rarityTiers = (variant: Entry["variant"]): readonly RarityTier[] =>
  variant === "unique" ? ["unique"] : NON_UNIQUE_TIERS;

/** UI string for each tier, matching the game's InventoryLabels SW_Rarity_* text. */
export const RARITY_LABEL: Readonly<Record<RarityTier, UiKey>> = {
  common: "rarityCommon",
  rare: "rarityRare",
  special: "raritySpecial",
  unique: "unique",
};
