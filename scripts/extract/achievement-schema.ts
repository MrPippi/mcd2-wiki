/** Shapes of the Steam achievement file in source-data and of src/data/achievements.json. */
import { z } from "zod";
import { LANGS } from "./langs";
import { LocalizedSchema, SlugSchema } from "./schemas";

const SteamTextSchema = z.object({ en: z.string(), zh: z.string() });

/** One row of source-data/Steam/Achievements/achievements.json; extra fields (icon URL, mapping notes) are ignored. */
export const SteamAchievementSchema = z.object({
  id: z.string().regex(/^[A-Z0-9_]+$/),
  /** The icon's file name in the same folder. */
  file: z.string().regex(/^[\w-]+\.jpe?g$/i, "must be a plain .jpg file name in the achievements folder"),
  globalPercent: z.number().min(0).max(100),
  name: z.object({ en: z.string().min(1), zh: z.string() }),
  description: SteamTextSchema,
});
export type SteamAchievement = z.infer<typeof SteamAchievementSchema>;

export const SteamAchievementsSchema = z.object({
  source: z.string().min(1),
  retrieved: z.string().min(1),
  achievements: z.array(SteamAchievementSchema).superRefine((rows, ctx) => {
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.id)) ctx.addIssue({ code: "custom", message: `duplicate achievement id ${row.id}` });
      seen.add(row.id);
    }
  }),
});
export type SteamAchievements = z.infer<typeof SteamAchievementsSchema>;

/** What unlocks a hidden achievement, named with the game's own text. */
export const AchievementConditionSchema = z.object({
  /** quest: complete the quest; task: complete one quest objective; boss: defeat the boss. */
  type: z.enum(["quest", "task", "boss"]),
  name: LocalizedSchema,
  /** Languages that show the English name because the game has none in that language. */
  untranslated: z.array(z.enum(LANGS)).optional(),
});
export type AchievementCondition = z.infer<typeof AchievementConditionSchema>;

export const AchievementSchema = z.object({
  id: z.string().min(1),
  slug: SlugSchema,
  /** Published path under public/; absent when Steam's icon file is missing. */
  icon: z.string().optional(),
  /** Share of Steam players who unlocked it, 0–100. */
  globalPercent: z.number().min(0).max(100),
  /** Steam hides the description until the achievement is unlocked. */
  hidden: z.boolean(),
  name: LocalizedSchema,
  description: LocalizedSchema.optional(),
  /** Hidden achievements only: what unlocks it (a spoiler the page reveals on request). */
  condition: AchievementConditionSchema.optional(),
  /** Languages that show the English text because Steam has none in that language. */
  untranslated: z.array(z.enum(LANGS)).optional(),
});
export type Achievement = z.infer<typeof AchievementSchema>;

export const AchievementDataSchema = z.object({
  source: z.string(),
  retrieved: z.string(),
  achievements: z.array(AchievementSchema),
});
export type AchievementData = z.infer<typeof AchievementDataSchema>;
