import type { Category, Lang } from "../../scripts/extract/config";
import { compareLang } from "./lang";
import type { ArmorPiece } from "../../scripts/extract/schemas";
import type { MarkerKind } from "./map/kinds";
import { t, type UiKey } from "./ui-strings";

export type { Lang };

/** Kept for existing callers; Task 4 removes it in favour of compareLang. */
export const otherLang = compareLang;

export { t, tCount, type UiKey } from "./ui-strings";

const CATEGORY_KEY = {
  melee: "categoryMelee",
  ranged: "categoryRanged",
  armor: "categoryArmor",
  artifact: "categoryArtifact",
  talisman: "categoryTalisman",
  cape: "categoryCape",
  pet: "categoryPet",
  skin: "categorySkin",
  enchantment: "categoryEnchantment",
  "enchantment-book": "categoryEnchantmentBook",
  effect: "categoryEffect",
  status: "categoryStatus",
} as const satisfies Record<Category, UiKey>;

const PIECE_KEY = {
  helmet: "pieceHelmet",
  chest: "pieceChest",
  leggings: "pieceLeggings",
  boots: "pieceBoots",
} as const satisfies Record<ArmorPiece, UiKey>;

const MARKER_KEY = {
  minecart: "markerMinecart",
  rift: "markerRift",
  portal: "markerPortal",
  merchant: "markerMerchant",
  area: "markerArea",
} as const satisfies Record<MarkerKind, UiKey>;

export const categoryLabel = (category: Category, lang: Lang): string => t(lang, CATEGORY_KEY[category]);
export const pieceLabel = (piece: ArmorPiece, lang: Lang): string => t(lang, PIECE_KEY[piece]);
export const markerLabel = (kind: MarkerKind, lang: Lang): string => t(lang, MARKER_KEY[kind]);

export const NAV_GROUPS: readonly { key: UiKey; categories: readonly Category[] }[] = [
  { key: "equipment", categories: ["melee", "ranged", "armor", "artifact", "talisman"] },
  { key: "enchanting", categories: ["enchantment", "effect"] },
];

// Published categories. Enchantment books have no pages of their own: each one is shown on the
// enchantment it grants. Statuses, capes, pets and skins are still extracted but not published for now.
export const GRID_CATEGORIES = ["melee", "ranged", "artifact", "talisman", "enchantment"] as const satisfies readonly Category[];
export const TABLE_CATEGORIES = ["effect"] as const satisfies readonly Category[];
