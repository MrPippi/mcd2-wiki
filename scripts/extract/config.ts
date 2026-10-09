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

export const ICON_CATEGORIES: ReadonlySet<Category> = new Set(["melee", "ranged", "armor", "artifact"]);

export const PATHS = {
  iconRootRel: "Assets/Art/Characters/Player/Equipment",
  localeFile: (sourceRoot: string, culture: string): string =>
    path.join(sourceRoot, "Localization", "All", culture, "All.json"),
} as const;
