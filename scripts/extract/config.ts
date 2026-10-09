import path from "node:path";

export const LANGS = ["zh", "en"] as const;
export type Lang = (typeof LANGS)[number];

export const CULTURE: Readonly<Record<Lang, string>> = { zh: "zh-Hant", en: "en" };

export const CATEGORIES = [
  "melee",
  "ranged",
  "armor",
  "artifact",
  "enchantment",
  "enchantment-book",
  "effect",
  "status",
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
];

export interface IconSource {
  /** Folder under source-data that holds this category's T_UI_*.png icons. */
  readonly root: string;
  /** Retry with the id's first segment (Burning_Infinite → Burning) when no icon matches. */
  readonly fallbackToBase: boolean;
}

const EQUIPMENT_ICONS: IconSource = { root: "Assets/Art/Characters/Player/Equipment", fallbackToBase: false };
const ENCHANTMENT_ICONS: IconSource = { root: "Assets/UI/Icons/Enchantments", fallbackToBase: true };
const STATUS_ICONS: IconSource = { root: "Assets/UI/Icons/Statuses", fallbackToBase: true };

export const ICON_SOURCES: Readonly<Partial<Record<Category, IconSource>>> = {
  melee: EQUIPMENT_ICONS,
  ranged: EQUIPMENT_ICONS,
  armor: EQUIPMENT_ICONS,
  artifact: EQUIPMENT_ICONS,
  enchantment: ENCHANTMENT_ICONS,
  "enchantment-book": ENCHANTMENT_ICONS,
  status: STATUS_ICONS,
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

export const PATHS = {
  localeFile: (sourceRoot: string, culture: string): string =>
    path.join(sourceRoot, "Localization", "All", culture, "All.json"),
} as const;
