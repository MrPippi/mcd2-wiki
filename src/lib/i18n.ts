import type { Category, Lang } from "../../scripts/extract/config";
import type { ArmorPiece } from "../../scripts/extract/schemas";
import type { MarkerKind } from "./map/kinds";
import { t, type UiKey } from "./ui-strings";

export type { Lang };

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

export { GRID_CATEGORIES, NAV_GROUPS, TABLE_CATEGORIES } from "./nav";
