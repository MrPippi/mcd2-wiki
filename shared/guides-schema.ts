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
  /** That the game balances threat with the SecondPass row of DT_GameBalanceDefinition, and that Normal difficulty multiplies by 1. */
  threatBalanceRow: z.boolean(),
  /** That the odds model (affix-pool.ts) matches how the game rolls random effects; reconstructed from the data and a third-party table, not read from the game. */
  affixOdds: z.boolean().default(false),
  /** That the drop odds model (drop-models.ts) matches how the game rolls loot; rebuilt from the data and a third-party table, and the tables do not say where chests spawn. */
  dropOdds: z.boolean().default(false),
  /** That a soul enchantment tier applies only its own row's modifiers (not also the family row's or the generic Lvl.I–III rows'), and that ThreatLevelSettings gates the tiers. */
  soulEnchantmentLevels: z.boolean().default(false),
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

const Range = z.object({ min: z.number(), max: z.number() });

/** One threat level (1..20). A part whose curve is missing from the data is left out. */
const ThreatRowSchema = z.object({
  level: z.number().int().min(1),
  recommendedLevel: Count.optional(),
  /** Multiplier on the player's attack power (CT_GlobalDifficultySettings). */
  attackPower: z.number().optional(),
  /** Multiplier on the player's damage resistance. */
  damageResistance: z.number().optional(),
  /** Chance factor of effect tiers I, II and III. */
  effectTiers: z.tuple([z.number(), z.number(), z.number()]).optional(),
  /** Drop chance factor of each rarity. */
  rarity: z.object({ common: z.number(), rare: z.number(), special: z.number(), unique: z.number() }).optional(),
  mobVariantChance: Range.optional(),
  soulStatedCost: Range.optional(),
  minibossCost: Range.optional(),
});

export const DIFFICULTIES = ["low", "normal", "high"] as const;

const DifficultySchema = z.object({
  id: z.enum(DIFFICULTIES),
  scalar: z.number(),
  name: TextSchema,
  description: TextSchema.optional(),
  /** The game's own words for the damage you receive / deal ("Low", "High", "Default"). */
  received: TextSchema.optional(),
  dealt: TextSchema.optional(),
  /** Multiplier on your damage resistance. */
  incoming: z.number(),
  /** Multiplier on your attack power. */
  outgoing: z.number(),
  /** The multipliers' curve row is missing from the data, so 1 is assumed. */
  assumed: z.boolean().optional(),
  /** This difficulty zeroes the Special and Unique drop chance (DT_RarityChanceDefinition). */
  noRareDrops: z.boolean().optional(),
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
  threat: z.array(ThreatRowSchema),
  difficulty: z.array(DifficultySchema),
});
export type GuidesData = z.infer<typeof GuidesDataSchema>;
export type VendorData = GuidesData["vendors"][number];
export type MerchantData = NonNullable<GuidesData["merchant"]>;
export type EnchantCost = GuidesData["enchanting"]["costs"][number];
export type RarityTier = GuidesData["rarity"]["tiers"][number];
export type DropRow = GuidesData["rarity"]["drops"][number];
export type SecretTalisman = GuidesData["secretTalismans"]["talismans"][number];
export type Stage = GuidesData["stages"][number];
export type ThreatRow = GuidesData["threat"][number];
export type DifficultyData = GuidesData["difficulty"][number];
export type Difficulty = (typeof DIFFICULTIES)[number];
