export * from "./langs";

export const CATEGORIES = [
  "melee",
  "ranged",
  "armor",
  "artifact",
  "talisman",
  "enchantment",
  "enchantment-book",
  "effect",
  "status",
  "cape",
  "pet",
  "skin",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface IconSource {
  /** Folder under source-data that holds this category's T_UI_*.png icons. */
  readonly root: string;
  /** Retry with the id's first segment (Burning_Infinite → Burning) when no icon matches. */
  readonly fallbackToBase: boolean;
  /** File name pattern, when the icons are not named T_UI_*.png. */
  readonly pattern?: RegExp;
  /** Icons are decoration only: entries without one are still published. */
  readonly optional?: boolean;
}

const EQUIPMENT_ICONS: IconSource = { root: "Assets/Art/Characters/Player/Equipment", fallbackToBase: false };
const ENCHANTMENT_ICONS: IconSource = { root: "Assets/UI/Icons/Enchantments", fallbackToBase: true };
const STATUS_ICONS: IconSource = { root: "Assets/UI/Icons/Statuses", fallbackToBase: true };
const TALISMAN_ICONS: IconSource = { root: "Assets/Art/Characters/Player/Equipment/Talismans", fallbackToBase: false };
const CAPE_ICONS: IconSource = { root: "Assets/Art/Characters/Player/Capes", fallbackToBase: false };
const PET_ICONS: IconSource = { root: "Assets/Art/Characters/Friendlies/Pets", fallbackToBase: false };
// Effect icons live in the OreUI plugin, outside Assets/; copy that folder into source-data with the same path.
const EFFECT_ICONS: IconSource = { root: "Plugins/OreUI/Content/UI/Icons/Effects", fallbackToBase: false, optional: true };
const SKIN_ICONS: IconSource = {
  root: "Assets/Art/Characters/Player/Skins",
  fallbackToBase: false,
  pattern: /(?:^|\/)T_[^/]*_Icon\.png$/i,
};

export const ICON_SOURCES: Readonly<Partial<Record<Category, IconSource>>> = {
  melee: EQUIPMENT_ICONS,
  ranged: EQUIPMENT_ICONS,
  armor: EQUIPMENT_ICONS,
  artifact: EQUIPMENT_ICONS,
  enchantment: ENCHANTMENT_ICONS,
  "enchantment-book": ENCHANTMENT_ICONS,
  status: STATUS_ICONS,
  talisman: TALISMAN_ICONS,
  cape: CAPE_ICONS,
  pet: PET_ICONS,
  skin: SKIN_ICONS,
  effect: EFFECT_ICONS,
};

/**
 * Slot frame art drawn around icons on the site, copied to public/icons/frames/<name>.png.
 * The inventory slot for gear is drawn in CSS instead: in game it is a flat shader-drawn slot.
 */
export const FRAME_SOURCES = {
  enchantment: "Assets/UI/Icons/Enchantments/T_UI_Enchantment_Book_Slot.png",
  artifact: "Assets/UI/HUD/Player/Hotbar/Artifacts/Slot/T_UI_ArtifactSlot_Default.png",
} as const;
export type FrameName = keyof typeof FRAME_SOURCES;

const categoryIcon = (name: string): string => `Assets/UI/Icons/Categories/T_UI_Icon_Category_${name}.png`;

/** In-game inventory tab icons, copied to public/icons/ui/<key>.png. Skins have none. */
export const UI_ICON_SOURCES = {
  melee: categoryIcon("Melee"),
  ranged: categoryIcon("Ranged"),
  armor: categoryIcon("Chest"),
  // The game's artifact tab uses the potion icon.
  artifact: categoryIcon("Potion"),
  enchantment: categoryIcon("Enchantment"),
  effect: categoryIcon("Effects"),
  // Statuses have no tab in game; the character stats tab icon stands in.
  status: categoryIcon("Stats"),
  helmet: categoryIcon("Helmet"),
  chest: categoryIcon("Chest"),
  leggings: categoryIcon("Legs"),
  boots: categoryIcon("Boots"),
  equipment: categoryIcon("Weapons"),
  all: categoryIcon("All"),
  talisman: categoryIcon("Talisman"),
  cape: categoryIcon("Cape"),
  pet: categoryIcon("Pet"),
  // The map entry uses the game's location pin.
  map: "Assets/UI/Icons/Location/T_UI_Icon_Location.png",
} as const;
export type UiIconKey = keyof typeof UI_ICON_SOURCES;
