import type { Entry } from "../../scripts/extract/schemas";
import type { UiKey } from "./i18n";

/** The game's four rarity tiers (SW.Rarity.*), lowest first. */
export type RarityTier = "common" | "rare" | "special" | "unique";

const NON_UNIQUE_TIERS: readonly RarityTier[] = ["common", "rare", "special"];

/**
 * Tiers to show for an entry. Unique items are always Unique. The extracted data has no fixed tier for
 * other items (the game only reads SW.Rarity.* when an item drops), so every tier they can have is listed.
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
