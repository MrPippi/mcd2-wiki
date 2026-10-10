import { z } from "zod";
import { SlugSchema } from "./schemas";

export const ARCHETYPES = ["Fighter", "Mage", "Ranger", "Summoner", "Support", "Tank", "Trickster"] as const;
export const WEIGHTS = ["Light", "Medium", "Heavy"] as const;

/** Distances are in blocks (game units ÷ 100). */
const SwingSchema = z.object({
  damage: z.number(),
  /** Times the swing hits (VariantLoopAmount). */
  hits: z.number().int(),
  stagger: z.number(),
  reach: z.number(),
  knockback: z.number(),
});

const MeleeSchema = z.object({
  swings: z.array(SwingSchema),
  jump: z.object({ damage: z.number(), stagger: z.number(), reach: z.number(), knockback: z.number() }).optional(),
});

const RangedSchema = z.object({
  /** Damage of one projectile. */
  damage: z.number(),
  /** Projectiles fired per shot, across every volley. */
  projectiles: z.number().int(),
  chargedMultiplier: z.number(),
  attackRateSeconds: z.number(),
  ammo: z.number().int(),
  range: z.number(),
  chargeSeconds: z.number(),
  rechargeSeconds: z.number(),
  jumpShotMultiplier: z.number(),
  stagger: z.number(),
  knockback: z.number(),
});

/** How the game prints an effect's magnitude in its description (from its FormattingData). */
export const EffectFormatSchema = z.object({
  percent: z.boolean(),
  multiplier: z.number(),
  offset: z.number(),
  maxFractionDigits: z.number().int(),
});
export type EffectFormat = z.infer<typeof EffectFormatSchema>;

export const WeaponSchema = z.object({
  archetypes: z.array(z.enum(ARCHETYPES)),
  weight: z.enum(WEIGHTS).optional(),
  melee: MeleeSchema.optional(),
  ranged: RangedSchema.optional(),
  /** Effects the weapon can roll, with their raw tier I/II/III magnitudes. */
  compatible: z.array(z.object({ effect: SlugSchema, tiers: z.tuple([z.number(), z.number(), z.number()]) })),
  /**
   * A unique weapon's built-in bonus. "enchantment-book" points at a book standing in for an enchantment
   * that has no entry of its own (the game names it only on its book).
   */
  fixed: z
    .object({
      kind: z.enum(["effect", "enchantment", "enchantment-book"]),
      slug: SlugSchema,
      /** An effect's raw magnitude. */
      value: z.number().optional(),
      /** An enchantment's description values, already formatted as the game prints them. */
      values: z.array(z.string()).optional(),
    })
    .optional(),
});
export type Weapon = z.infer<typeof WeaponSchema>;

/** Weapon stats and effect rules read from the game's DataTables, keyed by weapon slug. */
export const WeaponDataSchema = z.object({
  weapons: z.record(SlugSchema, WeaponSchema),
  /** Display format of each effect whose description shows its magnitude, keyed by effect slug. */
  effectFormats: z.record(SlugSchema, EffectFormatSchema),
});
export type WeaponData = z.infer<typeof WeaponDataSchema>;
