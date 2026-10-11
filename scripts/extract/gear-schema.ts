import { z } from "zod";
import { SlugSchema } from "./schemas";

/** Printed description values per enchantment: three tiers (I–III), or one set for a unique with its own entry. */
export const EnchantmentDataSchema = z.record(SlugSchema, z.object({ tiers: z.array(z.array(z.string())).min(1) }));
export type EnchantmentData = z.infer<typeof EnchantmentDataSchema>;

/** Artifact numbers from DT_ItemDefinitionArtifact. Seconds and blocks. */
export const ArtifactDataSchema = z.record(
  SlugSchema,
  z.object({
    cooldownSeconds: z.number().optional(),
    soulCost: z.number().optional(),
    lifetimeSeconds: z.number().optional(),
    range: z.number().optional(),
    compatible: z.array(z.object({ effect: SlugSchema, tiers: z.tuple([z.number(), z.number(), z.number()]) })),
  }),
);
export type ArtifactData = z.infer<typeof ArtifactDataSchema>;

/** A talisman level: its description values (when the game data has them), companion multipliers, and XP to level up. */
const TalismanLevelSchema = z.object({
  values: z.array(z.string()).optional(),
  /** Absent at the last level. */
  xpToNextLevel: z.number().optional(),
  companion: z.object({ attack: z.number(), defence: z.number(), cooldown: z.number() }).optional(),
});

/** Talisman levels from DT_TalismanPropertyDefinition and the effect templates or companion data each level grants. */
export const TalismanDataSchema = z.record(
  SlugSchema,
  z.object({
    /** The effect whose description the talisman shows (its own description is a developer stub). */
    effect: SlugSchema.optional(),
    /** Its own description has values the game computes in code; the site shows them as unknown. */
    valuesUnknown: z.boolean().optional(),
    /** One of the game's SecretTalismans collection. */
    secret: z.boolean().optional(),
    /** A companion's base cooldown in seconds. */
    cooldownSeconds: z.number().optional(),
    levels: z.array(TalismanLevelSchema),
  }),
);
export type TalismanData = z.infer<typeof TalismanDataSchema>;
export type TalismanLevel = z.infer<typeof TalismanLevelSchema>;
