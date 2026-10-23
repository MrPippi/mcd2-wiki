/** Output shape of the soul enchantment page (src/data/soul-enchantments.json): the buffs a Soul Corrupted mob can carry. */
import { z } from "zod";
import { LANGS } from "./config";
import { LocalizedSchema } from "./schemas";

export const SOUL_TIERS = ["I", "II", "III"] as const;
export type SoulTier = (typeof SOUL_TIERS)[number];

/** The mob attributes a tier's gameplay effect changes, by site key (the extractor maps the game's attribute names). */
export const SOUL_ATTRIBUTES = [
  "healthMax", "poise", "movementSpeed", "meleeAttackSpeed", "rangedAttackSpeed",
  "damagePoison", "damageIce", "damageLightning", "damageFire", "damageMelee", "damageRanged",
  "resistPoison", "resistIce", "resistLightning", "resistFire", "resistMelee", "resistRanged",
  "resistBlast", "resistTnt", "resistElemental", "resistSoul", "knockbackResistance",
  "projectileDeflectChance", "negativeStatusDuration",
] as const;
export type SoulAttribute = (typeof SOUL_ATTRIBUTES)[number];

/** Attributes that are 0–1 chances (shown as percentages). */
export const SOUL_CHANCE_ATTRIBUTES: readonly SoulAttribute[] = ["projectileDeflectChance"];

/**
 * Ability values a tier shows, by site key. Distances are in blocks (game units ÷ 100), chances 0–1, times in
 * seconds; bubbleRadius is the game's own number (its unit is not known).
 */
export const SOUL_ABILITY_VALUES = [
  "blastBaseDamage", "blastDamageMultiplier", "blastRange", "blastCone",
  "swiftnessChance",
  "orbCount", "orbDamage", "orbCharge", "orbRange",
  "leechInterval", "leechRange",
  "rippleDamage", "rippleRadius", "rippleDelay",
  "bubbleRadius",
] as const;
export type SoulAbilityValue = (typeof SOUL_ABILITY_VALUES)[number];

export const SoulModifierSchema = z.object({
  attribute: z.enum(SOUL_ATTRIBUTES),
  /** multiply: the game's MultiplyAdditive or MultiplyCompound (×value); add: AddBase (+value). */
  op: z.enum(["multiply", "add"]),
  value: z.number(),
});
export type SoulModifier = z.infer<typeof SoulModifierSchema>;

export const SoulTierSchema = z.object({
  tier: z.enum(SOUL_TIERS),
  /** ThreatLevelSettings of the tier row. */
  threat: z.object({ min: z.number(), max: z.number() }),
  modifiers: z.array(SoulModifierSchema),
  ability: z.array(z.object({ key: z.enum(SOUL_ABILITY_VALUES), value: z.number() })),
});
export type SoulTierData = z.infer<typeof SoulTierSchema>;

export const SoulFamilySchema = z.object({
  /** The family row name (Poison, SoulOrbs…). */
  id: z.string(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: LocalizedSchema,
  untranslated: z.array(z.enum(LANGS)),
  icon: z.string().optional(),
  tiers: z.array(SoulTierSchema),
  /**
   * Bestiary mobs whose Soul Corrupted data excludes this family (MobConditions.ExcludedSoulEnchantments, own or through
   * the trait closure); partial: only some of the Soul Corrupted rows behind the page (same-named variants) exclude it.
   */
  excludedMobs: z.array(z.object({ slug: z.string(), partial: z.boolean() })),
  /** Quest slugs whose arena waves exclude this family (ExcludedSoulEnchantmentsOverride). */
  excludedQuests: z.array(z.string()),
});
export type SoulFamily = z.infer<typeof SoulFamilySchema>;

export const SoulEnchantmentDataSchema = z.object({
  /** guides-status.json soulEnchantmentLevels: how the tier rows combine with the family row and the generic level rows is confirmed. */
  verified: z.boolean(),
  families: z.array(SoulFamilySchema),
  /** The generic Lvl.I–III rows (not tied to a family). */
  levels: z.array(z.object({ tier: z.enum(SOUL_TIERS), modifiers: z.array(SoulModifierSchema) })),
});
export type SoulEnchantmentData = z.infer<typeof SoulEnchantmentDataSchema>;

export const EMPTY_SOUL_ENCHANTMENTS: SoulEnchantmentData = { verified: false, families: [], levels: [] };
