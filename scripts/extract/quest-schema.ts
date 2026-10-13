/**
 * Quest shapes: the game's quest libraries (DT_QuestLibraries rows hold RawQuestData, a JSON string) as the extractor
 * reads them, and the output src/data/quests.json. Fields the extractor does not read pass through unchecked.
 */
import { z } from "zod";
import { LANGS } from "./config";
import { MobAreaSchema } from "./mob-schema";
import { LocalizedSchema } from "./schemas";

/** One node of a quest's goal tree: a group (subgoals) or a task (destination, interact_target, kill_target…). */
export interface RawGoal {
  readonly name: string;
  readonly type?: string;
  readonly show_progress?: boolean;
  readonly subgoals?: readonly RawGoal[];
  readonly howmany_count?: number;
  readonly kill_count?: number;
  readonly kill_target_types?: readonly string[];
  readonly mob_types?: readonly string[];
  readonly arena_tag?: string;
}

export const RawGoalSchema: z.ZodType<RawGoal> = z.lazy(() =>
  z.looseObject({
    name: z.string(),
    type: z.string().optional(),
    show_progress: z.boolean().optional(),
    subgoals: z.array(RawGoalSchema).optional(),
    howmany_count: z.number().int().optional(),
    kill_count: z.number().int().optional(),
    kill_target_types: z.array(z.string()).optional(),
    mob_types: z.array(z.string()).optional(),
    arena_tag: z.string().optional(),
  }),
);

const TagSchema = z.looseObject({ tagName: z.string() });
const LootEntrySchema = z.looseObject({ lootTags: z.looseObject({ gameplayTags: z.array(TagSchema) }) });

export const RawQuestSchema = z.looseObject({
  id: z.string().min(1),
  initial_state: z.string(),
  quest_type: z.string(),
  is_replayable: z.boolean(),
  prerequisites: z.array(z.string()),
  RewardData: z.looseObject({
    questSize: TagSchema,
    areaRewardScalingTag: TagSchema,
    firstCompletionLootSourceData: z.array(LootEntrySchema),
    lootSourceData: z.array(LootEntrySchema),
  }),
  goals: RawGoalSchema.optional(),
});
export type RawQuest = z.infer<typeof RawQuestSchema>;
export type RawLootEntry = z.infer<typeof LootEntrySchema>;

export const QuestLibrarySchema = z.looseObject({ Quests: z.array(RawQuestSchema) });
export const QuestLibraryRowSchema = z.looseObject({ Name: z.string(), RawQuestData: z.string() });

/** List sections, in page order. */
export const QUEST_SECTIONS = ["core", "side", "echoGolem", "bossReplay"] as const;
export type QuestSection = (typeof QUEST_SECTIONS)[number];
export const QUEST_SIZES = ["small", "medium", "large", "extraLarge"] as const;
export type QuestSize = (typeof QUEST_SIZES)[number];
/** The fixed rarity a SW.RarityChance.Quest.* tag gives a reward. */
export const QUEST_RARITIES = ["common", "rare", "special", "unique"] as const;
export type QuestRarity = (typeof QUEST_RARITIES)[number];

const LangsSchema = z.array(z.enum(LANGS));
const TextSchema = z.object({ text: LocalizedSchema, untranslated: LangsSchema });
const HtmlSchema = z.object({ html: LocalizedSchema, untranslated: LangsSchema });
const ObjectiveSchema = z.object({ text: LocalizedSchema, untranslated: LangsSchema, count: z.number().int().positive() });

const ItemRewardSchema = z.object({
  kind: z.literal("items"),
  /** The loot-sources.json source id ("quest:<row>"). */
  source: z.string(),
  /** Item keys ("<category>/<slug>") as loot-sources.json lists them. */
  items: z.array(z.string()).min(1),
  picks: z.object({ count: z.number().int().positive(), of: z.number().int().positive() }).optional(),
  rarity: z.enum(QUEST_RARITIES).optional(),
});
const AreaRewardSchema = z.object({
  kind: z.literal("areaDrop"),
  /** Random items from this area's drop pool. */
  area: z.object({ name: LocalizedSchema }),
  count: z.number().int().positive(),
  rarity: z.enum(QUEST_RARITIES).optional(),
});
export const QuestRewardSchema = z.discriminatedUnion("kind", [ItemRewardSchema, AreaRewardSchema]);
export type QuestReward = z.infer<typeof QuestRewardSchema>;

/** The emerald bundle of the quest's size: guaranteed drops plus rolls that may each fail. */
export const EmeraldsSchema = z.object({ guaranteed: z.number(), rolls: z.number(), chancePerRoll: z.number() });
export type Emeralds = z.infer<typeof EmeraldsSchema>;

export const QuestSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  id: z.string(),
  section: z.enum(QUEST_SECTIONS),
  type: z.enum(["core", "side"]),
  size: z.enum(QUEST_SIZES),
  replayable: z.boolean(),
  title: TextSchema,
  description: HtmlSchema.nullable(),
  completed: HtmlSchema.nullable(),
  /** The area the rewards scale with; null for quests the game ties to no area (the Echo Golem's). */
  region: MobAreaSchema.nullable(),
  /** Quest slugs, in the game's order. */
  prerequisites: z.array(z.string()),
  unlocks: z.array(z.string()),
  objectives: z.array(ObjectiveSchema),
  rewards: z.object({
    /** Given on the first completion only. */
    first: z.array(QuestRewardSchema),
    /** Given on every completion. */
    every: z.array(QuestRewardSchema),
    emeralds: EmeraldsSchema.nullable(),
  }),
  /** Bestiary slugs of the mobs the quest's tasks and arenas name. */
  mobs: z.array(z.string()),
});
export type Quest = z.infer<typeof QuestSchema>;

export const QuestDataSchema = z.object({
  /** In list order: core chain, side quests by region, Echo Golem quests, boss replays. */
  quests: z.array(QuestSchema),
  /** loot-sources.json quest source id → slugs of the quests known to give it (only where that is exact). */
  rewardSources: z.record(z.string(), z.array(z.string()).min(1)),
});
export type QuestData = z.infer<typeof QuestDataSchema>;

export const EMPTY_QUESTS: QuestData = { quests: [], rewardSources: {} };
