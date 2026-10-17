import { z } from "zod";
import { SlugSchema } from "./schemas";

/** The rarities an item page can show odds for (Common has no random effect). */
export const AFFIX_RARITIES = ["rare", "special", "unique"] as const;

const EntrySchema = z.object({
  /** The effect's site slug, or its effect tag when the site has no entry for it. */
  effect: z.string().min(1),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  ops: z.array(z.tuple([z.enum(["set", "add", "multiply"]), z.number()])).min(1),
});

/** Pool models shared by items; the item row names its model by hash. */
const ModelSchema = z.object({ entries: z.array(EntrySchema) });

const RaritySchema = z.object({
  rarity: z.enum(AFFIX_RARITIES),
  /** Random effects of the rarity. */
  slots: z.number().int().min(0),
  /** Extra random effects of a Soul Storm reward. */
  bonusSlots: z.number().int().min(0),
});

const ItemSchema = z.object({
  model: z.string().min(1),
  /** Effects the item always has (they never roll again). */
  fixed: z.array(z.string()),
  rarities: z.array(RaritySchema).min(1),
});

export const AffixDataSchema = z.object({
  /** Threat levels, and for each the weight factor of tier I, II, III templates. */
  levels: z.array(z.number().int().min(1)),
  tierFactors: z.array(z.tuple([z.number(), z.number(), z.number()])),
  models: z.record(z.string(), ModelSchema),
  items: z.record(SlugSchema, ItemSchema),
});
export type AffixData = z.infer<typeof AffixDataSchema>;
export type AffixItem = z.infer<typeof ItemSchema>;
