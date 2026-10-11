/** Output shapes of the Soul Storm page data (src/data/soul-storm.json) and its hand-kept status file. */
import { z } from "zod";
import { LANGS } from "./config";
import { MobAreaSchema, MobDropSchema } from "./mob-schema";
import { LocalizedSchema } from "./schemas";

/** The one switch for "schedule confirmed in game". Kept by hand in soul-storm-status.json. */
export const SoulStormStatusSchema = z.strictObject({
  verified: z.boolean(),
  anchorOffsetMinutes: z.number().int().min(-720).max(840),
  rotationOffset: z.number().int().nonnegative(),
});
export type SoulStormStatus = z.infer<typeof SoulStormStatusSchema>;

export const GENERATOR_TIERS = ["easy", "medium", "hard"] as const;
export const CHEST_TIERS = ["easy", "medium", "hard", "low", "high"] as const;
export const TEXT_IDS = ["title", "overview1", "overview2", "tutorial", "objective", "generatorHint", "shieldHint", "extraEffect", "generatorName"] as const;
export type TextId = (typeof TEXT_IDS)[number];

const LangSchema = z.enum(LANGS);
const TextSchema = z.object({ html: LocalizedSchema, untranslated: z.array(LangSchema) });

const GeneratorSchema = z.object({
  tier: z.enum(GENERATOR_TIERS),
  health: z.number(),
  healthByPlayers: z.array(z.number()),
  spawnWeight: z.number(),
  shield: z.object({ chance: z.number(), cooldownSeconds: z.number() }).nullable(),
  finalSummon: z.object({ healthFraction: z.number(), mobs: z.array(z.string()) }),
});

const ChestSchema = z.object({
  id: z.string(),
  group: z.enum(["generator", "final"]),
  tier: z.enum(CHEST_TIERS),
  slots: z.array(MobDropSchema),
});

export const SoulStormDataSchema = z.object({
  verified: z.boolean(),
  schedule: z.object({
    anchorRaw: z.string(),
    anchorUtc: z.string(),
    anchorOffsetMinutes: z.number(),
    durationSeconds: z.number(),
    cadenceSeconds: z.number(),
    rotationOffset: z.number(),
  }),
  rotation: z.array(MobAreaSchema),
  rotationUntranslated: z.array(LangSchema),
  texts: z.object({
    title: TextSchema,
    overview1: TextSchema,
    overview2: TextSchema,
    tutorial: TextSchema,
    objective: TextSchema,
    generatorHint: TextSchema,
    shieldHint: TextSchema,
    extraEffect: TextSchema,
    generatorName: TextSchema,
  }),
  unlock: z.object({ gameState: z.string() }).nullable(),
  generators: z.array(GeneratorSchema),
  resistances: z.array(z.object({ key: z.enum(["resistSoul", "resistMelee", "knockbackResistance"]), value: z.number() })),
  shieldHealth: z.number().nullable(),
  chests: z.array(ChestSchema),
  chestRarity: z.object({ common: z.number(), rare: z.number() }).nullable(),
  monstrosities: z.array(z.string()),
  icons: z.object({ header: z.string().optional(), generator: z.string().optional() }),
});
export type SoulStormData = z.infer<typeof SoulStormDataSchema>;
export type Generator = SoulStormData["generators"][number];
export type Chest = SoulStormData["chests"][number];

const EMPTY_LOCALIZED = LocalizedSchema.parse(Object.fromEntries(LANGS.map((lang) => [lang, ""])));
const EMPTY_TEXT = { html: EMPTY_LOCALIZED, untranslated: [] };

/** The output when the schedule or rotation table is missing: the page then shows only the official intro. */
export const EMPTY_SOUL_STORM: SoulStormData = {
  verified: false,
  schedule: { anchorRaw: "", anchorUtc: "", anchorOffsetMinutes: 0, durationSeconds: 0, cadenceSeconds: 0, rotationOffset: 0 },
  rotation: [],
  rotationUntranslated: [],
  texts: {
    title: EMPTY_TEXT, overview1: EMPTY_TEXT, overview2: EMPTY_TEXT, tutorial: EMPTY_TEXT, objective: EMPTY_TEXT,
    generatorHint: EMPTY_TEXT, shieldHint: EMPTY_TEXT, extraEffect: EMPTY_TEXT, generatorName: EMPTY_TEXT,
  },
  unlock: null,
  generators: [],
  resistances: [],
  shieldHealth: null,
  chests: [],
  chestRarity: null,
  monstrosities: [],
  icons: {},
};
