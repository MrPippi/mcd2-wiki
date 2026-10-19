import path from "node:path";
import type { Category } from "../../shared/config";

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
