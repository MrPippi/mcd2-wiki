import path from "node:path";

export const LANGS = ["zh", "en"] as const;
export type Lang = (typeof LANGS)[number];

export const CULTURE: Readonly<Record<Lang, string>> = { zh: "zh-Hant", en: "en" };

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

export type Release = "base" | "upcoming";

export interface TableSource {
  readonly namespace: string;
  readonly category: Category;
  readonly release: Release;
}

const table = (name: string, category: Category, release: Release): TableSource => ({
  namespace: `Text/Release/${name}.csv`,
  category,
  release,
});

export const TABLES: readonly TableSource[] = [
  table("DT_ItemDefinitionMelee", "melee", "base"),
  table("DT_R3ItemDefinitionMelee", "melee", "upcoming"),
  table("DT_R4ItemDefinitionMelee", "melee", "upcoming"),
  table("DT_ItemDefinitionRanged", "ranged", "base"),
  table("DT_R4ItemDefinitionRanged", "ranged", "upcoming"),
  table("DT_ItemDefinitionArmor", "armor", "base"),
  table("DT_R3ItemDefinitionArmor", "armor", "upcoming"),
  table("DT_R4ItemDefinitionArmor", "armor", "upcoming"),
  table("DT_ItemDefinitionArtifact", "artifact", "base"),
  table("DT_R3ItemDefinitionArtifact", "artifact", "upcoming"),
  table("DT_R4ItemDefinitionArtifact", "artifact", "upcoming"),
  table("DT_EnchantmentDefinition", "enchantment", "base"),
  table("DT_R4EnchantmentDefinition", "enchantment", "upcoming"),
  table("DT_ItemDefinitionEnchantmentBook", "enchantment-book", "base"),
  table("DT_R4ItemDefinitionEnchantmentBook", "enchantment-book", "upcoming"),
  table("DT_EffectDefinition", "effect", "base"),
  table("DT_R3EffectDefinition", "effect", "upcoming"),
  table("DT_StatusDefinition", "status", "base"),
  table("DT_R3StatusEffectDefinition", "status", "upcoming"),
  table("DT_R4StatusEffectDefinition", "status", "upcoming"),
  table("DT_ItemDefinitionTalisman", "talisman", "base"),
  table("DT_R3ItemDefinitionTalisman", "talisman", "upcoming"),
  table("DT_ItemDefinitionCape", "cape", "base"),
  table("DT_ItemDefinitionPet", "pet", "base"),
  table("DT_SkinDefinition", "skin", "base"),
];

export interface IconSource {
  /** Folder under source-data that holds this category's T_UI_*.png icons. */
  readonly root: string;
  /** Retry with the id's first segment (Burning_Infinite → Burning) when no icon matches. */
  readonly fallbackToBase: boolean;
  /** File name pattern, when the icons are not named T_UI_*.png. */
  readonly pattern?: RegExp;
}

const EQUIPMENT_ICONS: IconSource = { root: "Assets/Art/Characters/Player/Equipment", fallbackToBase: false };
const ENCHANTMENT_ICONS: IconSource = { root: "Assets/UI/Icons/Enchantments", fallbackToBase: true };
const STATUS_ICONS: IconSource = { root: "Assets/UI/Icons/Statuses", fallbackToBase: true };
const TALISMAN_ICONS: IconSource = { root: "Assets/Art/Characters/Player/Equipment/Talismans", fallbackToBase: false };
const CAPE_ICONS: IconSource = { root: "Assets/Art/Characters/Player/Capes", fallbackToBase: false };
const PET_ICONS: IconSource = { root: "Assets/Art/Characters/Friendlies/Pets", fallbackToBase: false };
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

/** In-game inventory tab icons, copied to public/icons/ui/<key>.png. Statuses and skins have none. */
export const UI_ICON_SOURCES = {
  melee: categoryIcon("Melee"),
  ranged: categoryIcon("Ranged"),
  armor: categoryIcon("Chest"),
  // The game's artifact tab uses the potion icon.
  artifact: categoryIcon("Potion"),
  enchantment: categoryIcon("Enchantment"),
  effect: categoryIcon("Effects"),
  helmet: categoryIcon("Helmet"),
  chest: categoryIcon("Chest"),
  leggings: categoryIcon("Legs"),
  boots: categoryIcon("Boots"),
  equipment: categoryIcon("Weapons"),
  all: categoryIcon("All"),
  talisman: categoryIcon("Talisman"),
  cape: categoryIcon("Cape"),
  pet: categoryIcon("Pet"),
} as const;
export type UiIconKey = keyof typeof UI_ICON_SOURCES;

/** Game branding, copied to public/icons/brand/<key>.png: browser tab icon, home-screen icon, link-preview image. */
export const BRAND_SOURCES = {
  favicon: "Assets/UI/Icons/SmallLogo.png",
  "app-icon": "Assets/UI/Icons/Logo.png",
  social: "Assets/UI/Icons/Square480x480Logo.png",
} as const;
export type BrandKey = keyof typeof BRAND_SOURCES;

/** Full-screen splash art (1920×1080, ~2.7 MB). It goes to src/assets so the site build resizes and re-encodes it. */
export const SPLASH_SOURCE = "Assets/UI/Icons/SplashScreen.png";
export const SPLASH_TARGET = "src/assets/brand/splash.png";

export const PATHS = {
  localeFile: (sourceRoot: string, culture: string): string =>
    path.join(sourceRoot, "Localization", "All", culture, "All.json"),
} as const;
