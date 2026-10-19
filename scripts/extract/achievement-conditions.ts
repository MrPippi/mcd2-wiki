/**
 * Unlock conditions of hidden achievements, from the game's DT_AchievementDefinition table. Steam shows no description
 * for these, so the page names what unlocks them: a quest (QuestTrackerLabels), a quest objective, or a boss (mob names).
 */
import path from "node:path";
import { z } from "zod";
import type { AchievementCondition } from "./achievement-schema";
import type { Lang } from "./config";
import { DATATABLES_DIR } from "./game-tables";
import { ExtractError, formatZodIssue, issue, type Issue } from "./issues";
import { gameText } from "./game-text";
import { readTableFile } from "./table-reader";
import type { LocaleFile } from "./schemas";

export const ACHIEVEMENT_DEFINITIONS_FILE = `${DATATABLES_DIR}/DT_AchievementDefinition.json`;
const QUEST_LABELS = "Text/Release/QuestTrackerLabels.csv";
const MOB_NAMES = /^Text\/Release\/DT_Mob\w*Definition\.csv$/;
const QUEST_STRUCT = "ConditionDefinitionQuest";
const BOSS_STRUCT = "ConditionDefinitionBoolBossKill";

const TagSchema = z.object({ TagName: z.string() });

const DefinitionRowSchema = z.object({
  AchievementId: z.string().min(1),
  Condition: z.object({
    InstancedStructScriptStruct: z.string(),
    QuestState: z.object({ bUseQuestState: z.boolean(), QuestName: z.string(), TaskName: z.string() }).optional(),
    BossTags: z.object({ GameplayTags: z.array(TagSchema) }).optional(),
  }),
});
export type AchievementDefinition = z.infer<typeof DefinitionRowSchema>;

type Locales = Readonly<Record<Lang, LocaleFile>>;

interface TextKey {
  readonly type: AchievementCondition["type"];
  readonly namespace: string;
  readonly key: string;
  readonly quest?: string;
}

export interface ConditionsResult {
  readonly conditions: ReadonlyMap<string, AchievementCondition>;
  readonly issues: Issue[];
}

export function parseAchievementDefinitions(raw: unknown, filePath: string): AchievementDefinition[] {
  const parsed = z.array(DefinitionRowSchema).safeParse(raw);
  if (!parsed.success) throw new ExtractError(`成就定義資料表驗證失敗：${filePath}（${formatZodIssue(parsed.error.issues[0])}）`);
  return parsed.data;
}

/** The DataTable rows, validated; undefined when source-data has no such table. */
export async function loadAchievementDefinitions(sourceRoot: string): Promise<AchievementDefinition[] | undefined> {
  const filePath = path.join(sourceRoot, ...ACHIEVEMENT_DEFINITIONS_FILE.split("/"));
  const raw = await readTableFile(filePath, "成就定義資料表");
  return raw === undefined ? undefined : parseAchievementDefinitions(raw, filePath);
}

/** `SW.Mob.Shade` → the mob-name table that holds `SW_Mob_Shade_SW_TextEntry_Name` in English. */
function bossKey(tag: string, locales: Locales): TextKey | undefined {
  const key = `${tag.replaceAll(".", "_")}_SW_TextEntry_Name`;
  const namespace = Object.keys(locales.en).find((name) => MOB_NAMES.test(name) && locales.en[name]?.[key]);
  return namespace ? { type: "boss", namespace, key } : undefined;
}

/** Where the condition's name lives: the quest when the quest state counts, otherwise the quest objective. */
function textKey(row: AchievementDefinition, locales: Locales): TextKey | undefined {
  const { InstancedStructScriptStruct: struct, QuestState: quest, BossTags: boss } = row.Condition;
  if (struct.endsWith(`.${QUEST_STRUCT}`) && quest) {
    return quest.bUseQuestState
      ? { type: "quest", namespace: QUEST_LABELS, key: quest.QuestName, quest: quest.QuestName }
      : { type: "task", namespace: QUEST_LABELS, key: quest.TaskName, quest: quest.QuestName };
  }
  const tag = boss?.GameplayTags[0]?.TagName;
  return struct.endsWith(`.${BOSS_STRUCT}`) && tag ? bossKey(tag, locales) : undefined;
}

function conditionFor(row: AchievementDefinition, locales: Locales): AchievementCondition | Issue {
  const id = row.AchievementId;
  const where = textKey(row, locales);
  if (!where) return issue("missing-achievement-condition", id);
  const found = gameText(locales, where.namespace, where.key);
  if (!found) return issue("missing-achievement-condition", `${id}: ${where.namespace.replace("Text/Release/", "")} ${where.key}`);
  const { text: name, untranslated } = found;
  return { type: where.type, name, ...(untranslated.length > 0 ? { untranslated } : {}), ...(where.quest ? { quest: where.quest } : {}) };
}

/** The condition of each listed achievement that has one the game names; the rest are reported. */
export function buildConditions(rows: readonly AchievementDefinition[], locales: Locales, ids: readonly string[]): ConditionsResult {
  const byId = new Map(rows.map((row) => [row.AchievementId, row]));
  const results = ids.map((id) => {
    const row = byId.get(id);
    return [id, row ? conditionFor(row, locales) : issue("missing-achievement-condition", id)] as const;
  });
  return {
    conditions: new Map(results.flatMap(([id, result]) => ("name" in result ? [[id, result] as const] : []))),
    issues: results.flatMap(([, result]) => ("name" in result ? [] : [result])),
  };
}
