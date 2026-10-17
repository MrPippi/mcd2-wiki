import { z } from "zod";
import { MAX_SLOTS } from "../../src/lib/affix-odds";
import { SlugSchema } from "./schemas";

/** The rarities an item page can show odds for (Common has no random effect). */
export const AFFIX_RARITIES = ["rare", "special", "unique"] as const;

const Weight = z.number().finite().min(0);

const EntrySchema = z.strictObject({
  /** The effect's site slug, or its effect tag when the site has no entry for it. */
  effect: z.string().min(1),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  ops: z.array(z.tuple([z.enum(["set", "add", "multiply"]), Weight])).min(1),
});

/** Pool models shared by items; the item row names its model by hash. */
const ModelSchema = z.strictObject({ entries: z.array(EntrySchema) });

const RaritySchema = z
  .strictObject({
    rarity: z.enum(AFFIX_RARITIES),
    /** Random effects of the rarity. */
    slots: z.number().int().min(0),
    /** Extra random effects of a Soul Storm reward. */
    bonusSlots: z.number().int().min(0),
  })
  .refine((one) => one.slots + one.bonusSlots <= MAX_SLOTS, { message: `a rarity rolls at most ${MAX_SLOTS} random effects, with the bonus included` });

const ItemSchema = z.strictObject({
  model: z.string().min(1),
  /** Effects the item always has (they never roll again). */
  fixed: z.array(z.string()),
  rarities: z.array(RaritySchema).min(1),
});

const strictlyAscending = (values: readonly number[]): boolean => values.every((value, index) => index === 0 || value > values[index - 1]);

export const AffixDataSchema = z
  .strictObject({
    /** Threat levels, and for each the weight factor of tier I, II, III templates. */
    levels: z.array(z.number().int().min(1)),
    tierFactors: z.array(z.tuple([Weight, Weight, Weight])),
    models: z.record(z.string(), ModelSchema),
    items: z.record(SlugSchema, ItemSchema),
  })
  .superRefine((data, context) => {
    if (!strictlyAscending(data.levels)) context.addIssue({ code: "custom", path: ["levels"], message: "threat levels must be unique and ascending" });
    if (data.tierFactors.length !== data.levels.length) context.addIssue({ code: "custom", path: ["tierFactors"], message: "one set of tier factors per threat level" });
    for (const [slug, item] of Object.entries(data.items)) {
      if (!Object.hasOwn(data.models, item.model)) context.addIssue({ code: "custom", path: ["items", slug, "model"], message: `unknown model ${item.model}` });
    }
  });
export type AffixData = z.infer<typeof AffixDataSchema>;
export type AffixItem = z.infer<typeof ItemSchema>;
