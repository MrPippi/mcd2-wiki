// Site navigation structure. Type-only imports: browser scripts (the category tabs) read this,
// so it must not pull in the UI dictionaries.
import type { Category } from "../../scripts/extract/config";
import type { UiKey } from "./ui-strings";

export const NAV_GROUPS: readonly { key: UiKey; categories: readonly Category[] }[] = [
  { key: "equipment", categories: ["melee", "ranged", "armor", "artifact", "talisman"] },
  { key: "enchanting", categories: ["enchantment", "effect"] },
];

// Published categories. Enchantment books have no pages of their own: each one is shown on the
// enchantment it grants. Statuses, capes, pets and skins are still extracted but not published for now.
export const GRID_CATEGORIES = ["melee", "ranged", "artifact", "talisman", "enchantment"] as const satisfies readonly Category[];
export const TABLE_CATEGORIES = ["effect"] as const satisfies readonly Category[];
