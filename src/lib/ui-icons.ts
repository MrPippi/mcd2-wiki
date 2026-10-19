import type { Category, UiIconKey } from "../../shared/config";
import type { ArmorPiece, UiIcons } from "../../shared/schemas";
import { extractedUiIcons } from "./data";

/** Game inventory tab icon for each site category; statuses and skins have none in game. */
const CATEGORY_ICON: Readonly<Partial<Record<Category, UiIconKey>>> = {
  melee: "melee",
  ranged: "ranged",
  armor: "armor",
  artifact: "artifact",
  enchantment: "enchantment",
  "enchantment-book": "enchantment",
  effect: "effect",
  talisman: "talisman",
  cape: "cape",
  pet: "pet",
};

const GROUP_ICON: Readonly<Record<string, UiIconKey>> = { equipment: "equipment" };

const lookup = (key: UiIconKey | undefined, icons: UiIcons): string | undefined => (key ? icons[key] : undefined);

export const uiIcon = (key: UiIconKey, icons: UiIcons = extractedUiIcons): string | undefined => lookup(key, icons);

export const categoryIcon = (category: Category, icons: UiIcons = extractedUiIcons): string | undefined =>
  lookup(CATEGORY_ICON[category], icons);

export const pieceIcon = (piece: ArmorPiece, icons: UiIcons = extractedUiIcons): string | undefined =>
  lookup(piece, icons);

export const groupIcon = (group: string, icons: UiIcons = extractedUiIcons): string | undefined =>
  lookup(GROUP_ICON[group], icons);
