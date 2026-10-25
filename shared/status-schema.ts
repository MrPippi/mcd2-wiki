/** Output shape of the status page data (src/data/statuses.json): what DT_StatusDefinition says about each status entry. */
import { z } from "zod";

/** The attributes a status's gameplay effect changes, by site key (the extractor maps the game's attribute names). */
export const STATUS_ATTRIBUTES = [
  "movementSpeed", "meleeAttackSpeed", "rangedAttackSpeed",
  "damage", "damageBonus", "damageTaken",
  "critChance", "critMultiplier", "deflectChance",
  "artifactCooldown", "artifactDamage", "soulGathering",
] as const;
export type StatusAttribute = (typeof STATUS_ATTRIBUTES)[number];

/** Attributes that are 0–1 chances (shown as percentages). */
export const STATUS_CHANCE_ATTRIBUTES: readonly StatusAttribute[] = ["critChance", "deflectChance"];

export const StatusModifierSchema = z.object({
  attribute: z.enum(STATUS_ATTRIBUTES),
  /** multiply: the game's MultiplyAdditive or MultiplyCompound (×value); add: AddBase (+value). */
  op: z.enum(["multiply", "add"]),
  value: z.number(),
});
export type StatusModifier = z.infer<typeof StatusModifierSchema>;

export const STATUS_SOURCE_KINDS = ["artifact", "enchantment", "effect", "mob"] as const;
export type StatusSourceKind = (typeof STATUS_SOURCE_KINDS)[number];

export const StatusSourceSchema = z.object({ kind: z.enum(STATUS_SOURCE_KINDS), slug: z.string() });
export type StatusSource = z.infer<typeof StatusSourceSchema>;

export const StatusFusionSchema = z.object({
  /** The other status entry slug that fuses with this one. */
  with: z.string(),
  /** The fused status row name (Overload); the game gives it no text, so the page shows the row name. */
  result: z.string(),
  /** bIsNegativeFusion. */
  negative: z.boolean(),
  /** StatusImmunityDuration, in seconds. */
  immunity: z.number(),
});
export type StatusFusion = z.infer<typeof StatusFusionSchema>;

export const StatusInfoSchema = z.object({
  /** The status entry slug (entries.json, category "status"). */
  slug: z.string(),
  alignment: z.enum(["positive", "negative", "neutral"]).optional(),
  /** Traits has SW.Status.NonStacking. */
  nonStacking: z.boolean(),
  /** StatusData.DefaultDuration in seconds; null for -1 (lasts until removed). A source can set its own duration. */
  duration: z.number().nullable(),
  modifiers: z.array(StatusModifierSchema),
  fusions: z.array(StatusFusionSchema),
  /** Rows that name this status (to apply it, or as a buff of their own), linked to their pages. */
  sources: z.array(StatusSourceSchema),
});
export type StatusInfo = z.infer<typeof StatusInfoSchema>;

export const StatusDataSchema = z.object({ statuses: z.array(StatusInfoSchema) });
export type StatusData = z.infer<typeof StatusDataSchema>;

export const EMPTY_STATUSES: StatusData = { statuses: [] };
