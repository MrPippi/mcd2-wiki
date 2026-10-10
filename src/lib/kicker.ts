import type { Category } from "../../scripts/extract/config";
import type { Entry } from "../../scripts/extract/schemas";

const SINGULAR: Readonly<Record<Category, string>> = {
  melee: "MELEE WEAPON",
  ranged: "RANGED WEAPON",
  armor: "ARMOR",
  artifact: "ARTIFACT",
  talisman: "TALISMAN",
  enchantment: "ENCHANTMENT",
  "enchantment-book": "ENCHANTMENT BOOK",
  effect: "EFFECT",
  status: "STATUS",
  cape: "CAPE",
  pet: "PET",
  skin: "SKIN",
};

/** The small game-style label above an item name, e.g. "UNIQUE MELEE WEAPON". */
export const itemKicker = (category: Category, variant: Entry["variant"]): string =>
  `${variant === "unique" ? "UNIQUE " : ""}${SINGULAR[category]}`;

export const setKicker = (variant: Entry["variant"]): string =>
  variant === "unique" ? "UNIQUE ARMOR SET" : "ARMOR SET";
