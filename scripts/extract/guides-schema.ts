/** Output shapes of the mechanics guides (src/data/guides.json) and their hand-kept status file. */
import { z } from "zod";
import { LANGS } from "./config";
import { LocalizedSchema } from "./schemas";

/** Facts the data states but cannot explain; each stays flagged "unconfirmed" until checked in game. Kept by hand in guides-status.json. */
export const GuidesStatusSchema = z.strictObject({
  /** How EnchantCostMap's per-level increase applies to levels II and III. */
  enchantCostPerLevel: z.boolean(),
  /** How the drop-weight rows combine, and the odds at each threat level. */
  rarityOdds: z.boolean(),
});
export type GuidesStatus = z.infer<typeof GuidesStatusSchema>;

export const RARITIES = ["common", "rare", "special", "unique"] as const;
export type Rarity = (typeof RARITIES)[number];
export const VENDORS = ["merchant", "blacksmith", "enchantsmith"] as const;
export type Vendor = (typeof VENDORS)[number];
export const GEAR_TYPES = ["melee", "ranged", "helmet", "chest", "leggings", "boots", "artifact"] as const;
export type GearType = (typeof GEAR_TYPES)[number];
export const DROP_SOURCES = ["default", "boss"] as const;

export const TEXT_IDS = [
  "echoShards", "emeralds", "enchantmentPoints",
  "merchantName", "blacksmithName", "enchantsmithName",
  "merchantIntro", "blacksmithIntro", "enchantsmithIntro",
  "merchantLevel2", "merchantLevel3", "blacksmithLevel2", "blacksmithLevel3", "enchantsmithLevel2", "enchantsmithLevel3",
  "merchantTutorial", "enchantsmithTutorial", "enchantmentPointsTutorial", "echoShardsTutorial", "levelingTitle", "levelingTutorial",
] as const;
export type TextId = (typeof TEXT_IDS)[number];

const LangSchema = z.enum(LANGS);
export const TextSchema = z.object({ html: LocalizedSchema, untranslated: z.array(LangSchema) });
export type GuideText = z.infer<typeof TextSchema>;

const RaritySchema = z.enum(RARITIES);
const Count = z.number().int().nonnegative();

const VendorSchema = z.object({
  id: z.enum(VENDORS),
  /** Echo Shards to reach each level above 1, in level order. */
  levels: z.array(z.object({ level: z.number().int().min(2), cost: Count })),
});

const MerchantSchema = z.object({
  slotsPerRarity: Count,
  refreshCost: Count,
  basePrices: z.array(z.object({ gear: z.enum(GEAR_TYPES), price: Count })),
  multipliers: z.array(z.object({ rarity: RaritySchema, value: z.number() })),
});

const EnchantCostSchema = z.object({
  rarity: RaritySchema,
  points: Count,
  pointsPerLevel: Count,
  shards: Count,
  shardsPerLevel: Count,
});

const RarityTierSchema = z.object({
  rarity: RaritySchema,
  rerollableEffects: Count,
  /** Extra effects on Soul Storm rewards; null when the rarity lists none. */
  stormExtraEffects: z.number().nullable(),
  itemPowerOffset: z.number(),
});

const DropWeightSchema = z.object({ rarity: RaritySchema, weight: z.number(), operation: z.enum(["set", "multiply"]) });

const SecretTalismanSchema = z.object({
  slug: z.string(),
  /** A loot chest that holds exactly this talisman exists in the data. */
  chest: z.boolean(),
  /** Quests whose rewards name this talisman; name is null when the game text has none. */
  quests: z.array(z.object({ id: z.string(), name: TextSchema.nullable() })),
});

export const GuidesDataSchema = z.object({
  verified: GuidesStatusSchema,
  texts: z.record(z.enum(TEXT_IDS), TextSchema),
  caps: z.object({ emeralds: Count, echoShards: Count, level: Count }).nullable(),
  vendors: z.array(VendorSchema),
  merchant: MerchantSchema.nullable(),
  enchanting: z.object({ costs: z.array(EnchantCostSchema), maxLevel: Count }),
  rarity: z.object({
    tiers: z.array(RarityTierSchema),
    drops: z.array(z.object({ source: z.enum(DROP_SOURCES), weights: z.array(DropWeightSchema) })),
  }),
  secretTalismans: z.object({
    completion: TextSchema.nullable(),
    door: TextSchema.nullable(),
    talismans: z.array(SecretTalismanSchema),
  }),
  stages: z.array(z.object({ id: z.string(), level: Count, name: TextSchema })),
});
export type GuidesData = z.infer<typeof GuidesDataSchema>;
export type VendorData = GuidesData["vendors"][number];
export type MerchantData = NonNullable<GuidesData["merchant"]>;
export type EnchantCost = GuidesData["enchanting"]["costs"][number];
export type RarityTier = GuidesData["rarity"]["tiers"][number];
export type DropRow = GuidesData["rarity"]["drops"][number];
export type SecretTalisman = GuidesData["secretTalismans"]["talismans"][number];
export type Stage = GuidesData["stages"][number];
