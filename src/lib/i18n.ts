import type { Category, Lang } from "../../scripts/extract/config";
import type { ArmorPiece } from "../../scripts/extract/schemas";
import type { LootSlotKey, Mob, StatKey } from "../../scripts/extract/mob-schema";
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
  quest: "markerQuest",
  "quest-area": "markerQuestArea",
  area: "markerArea",
} as const satisfies Record<MarkerKind, UiKey>;

const STAT_UI_KEY = {
  health: "statHealth",
  movementSpeed: "statMovementSpeed",
  poise: "statPoise",
  poiseDelay: "statPoiseDelay",
  poiseRecovery: "statPoiseRecovery",
  sightRadius: "statSightRadius",
  mass: "statMass",
  soulYield: "statSoulYield",
  meleeAttackSpeed: "statMeleeAttackSpeed",
  rangedAttackSpeed: "statRangedAttackSpeed",
  shield: "statShield",
  knockbackResistance: "statKnockbackResistance",
  resistBlast: "statResistBlast",
  resistMelee: "statResistMelee",
  resistRanged: "statResistRanged",
  resistFire: "statResistFire",
  resistIce: "statResistIce",
  resistLightning: "statResistLightning",
  resistPoison: "statResistPoison",
  resistSoul: "statResistSoul",
  resistElemental: "statResistElemental",
  resistBase: "statResistBase",
  resistTnt: "statResistTnt",
} as const satisfies Record<StatKey, UiKey>;

const LOOT_SLOT_UI_KEY = {
  item: "lootSlotItem",
  specialGear: "lootSlotSpecialGear",
  enchantedBook: "lootSlotEnchantedBook",
  talismans: "lootSlotTalismans",
  emeralds: "lootSlotEmeralds",
  springStone: "lootSlotSpringStone",
  consumable: "lootSlotConsumable",
  tnt: "lootSlotTnt",
} as const satisfies Record<LootSlotKey, UiKey>;

const MOB_KIND_UI_KEY = {
  boss: "mobKindBoss",
  miniboss: "mobKindMiniboss",
  regular: "mobKindRegular",
  variant: "mobKindVariant",
} as const satisfies Record<Mob["kind"], UiKey>;

export const categoryLabel = (category: Category, lang: Lang): string => t(lang, CATEGORY_KEY[category]);
export const pieceLabel = (piece: ArmorPiece, lang: Lang): string => t(lang, PIECE_KEY[piece]);
export const markerLabel = (kind: MarkerKind, lang: Lang): string => t(lang, MARKER_KEY[kind]);
export const statLabel = (key: StatKey, lang: Lang): string => t(lang, STAT_UI_KEY[key]);
export const lootSlotLabel = (slot: LootSlotKey, lang: Lang): string => t(lang, LOOT_SLOT_UI_KEY[slot]);
export const mobKindLabel = (kind: Mob["kind"], lang: Lang): string => t(lang, MOB_KIND_UI_KEY[kind]);

export { GRID_CATEGORIES, NAV_GROUPS, TABLE_CATEGORIES } from "./nav";
