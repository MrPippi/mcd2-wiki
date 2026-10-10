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
