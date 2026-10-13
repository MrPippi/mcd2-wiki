import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENT_DEFINITIONS_FILE,
  buildConditions,
  loadAchievementDefinitions,
  parseAchievementDefinitions,
} from "../../../scripts/extract/achievement-conditions";
import { LANGS, type Lang } from "../../../scripts/extract/config";
import { ExtractError } from "../../../scripts/extract/issues";
import type { LocaleFile } from "../../../scripts/extract/schemas";
import { byLang } from "../../../src/lib/lang";
import { makeLocales, ns } from "../../helpers/locales";

const QUEST_LABELS = "Text/Release/QuestTrackerLabels.csv";
const MOBS = ns("DT_MobType3Definition");

const questRow = (id: string, useQuest: boolean, quest: string, task: string) => ({
  Name: id,
  AchievementId: id,
  Condition: {
    InstancedStructScriptStruct: "/Script/Achievements.ConditionDefinitionQuest",
    QuestState: { bUseQuestState: useQuest, QuestName: quest, QuestState: "Completed", TaskName: task, TaskState: "NotSet" },
  },
});

const ROWS = [
  questRow("COMPLETE_ARRIVE_IN_BRAVE_HAVEN_QUEST", true, "CA00", "None"),
  questRow("COMPLETE_ENTER_THE_NEW_DIMENSION_QUEST", false, "CA01", "CA01_PC03"),
  {
    Name: "DEFEAT_A_MONARCH",
    AchievementId: "DEFEAT_A_MONARCH",
    Condition: {
      InstancedStructScriptStruct: "/Script/Achievements.ConditionDefinitionBoolBossKill",
      BossTags: { GameplayTags: [{ TagName: "SW.Mob.Shade" }], ParentTags: [{ TagName: "SW.Mob" }] },
    },
  },
  { Name: "OPEN_100_CHESTS", AchievementId: "OPEN_100_CHESTS", Condition: { InstancedStructScriptStruct: "/Script/Achievements.ConditionDefinitionCountLootChests", MaxAmount: 100 } },
];

const LOCALES = makeLocales({
  [QUEST_LABELS]: {
    CA00: { en: "Escape from Squid Coast", zh: "逃離烏賊海岸", ja: "イカの海岸から脱出" },
    CA01_PC03: { en: "Enter the rift", zh: "進入裂隙" },
  },
  [MOBS]: { SW_Mob_Shade_SW_TextEntry_Name: { en: "Monarch", zh: "君主" } },
});

/** The same locales with one key removed from one language's file, as when that language ships no text for it. */
const without = (locales: Record<Lang, LocaleFile>, lang: Lang, namespace: string, key: string): Record<Lang, LocaleFile> =>
  byLang((each) => {
    if (each !== lang) return locales[each];
    const kept = Object.fromEntries(Object.entries(locales[each][namespace] ?? {}).filter(([name]) => name !== key));
    return { ...locales[each], [namespace]: kept };
  });

describe("parseAchievementDefinitions", () => {
  it("reads the rows and ignores fields it does not need", () => {
    expect(parseAchievementDefinitions(ROWS, "x.json").map((row) => row.AchievementId)).toContain("DEFEAT_A_MONARCH");
  });

  it("fails loudly with the file path when a row is malformed", () => {
    const bad = [{ ...ROWS[0], Condition: { InstancedStructScriptStruct: "/Script/Achievements.ConditionDefinitionQuest", QuestState: { bUseQuestState: "yes" } } }];
    expect(() => parseAchievementDefinitions(bad, "DataTables/UFS/DT_AchievementDefinition.json")).toThrow(ExtractError);
    expect(() => parseAchievementDefinitions(bad, "DataTables/UFS/DT_AchievementDefinition.json")).toThrow(/DT_AchievementDefinition\.json.*bUseQuestState/);
    expect(() => parseAchievementDefinitions({ rows: [] }, "a.json")).toThrow(/a\.json/);
  });
});

describe("buildConditions", () => {
  const ids = ["COMPLETE_ARRIVE_IN_BRAVE_HAVEN_QUEST", "COMPLETE_ENTER_THE_NEW_DIMENSION_QUEST", "DEFEAT_A_MONARCH", "OPEN_100_CHESTS", "NOT_IN_TABLE"];
  const result = buildConditions(parseAchievementDefinitions(ROWS, "x.json"), LOCALES, ids);

  it("names the quest when the condition uses the quest state", () => {
    const quest = result.conditions.get("COMPLETE_ARRIVE_IN_BRAVE_HAVEN_QUEST");
    expect(quest?.type).toBe("quest");
    expect(quest?.name.zh).toBe("逃離烏賊海岸");
    expect(quest?.name.en).toBe("Escape from Squid Coast");
    expect(quest?.name.ja).toBe("イカの海岸から脱出");
    expect(quest?.untranslated).toBeUndefined();
    expect(quest?.quest).toBe("CA00");
  });

  it("names the quest objective when the condition uses a task", () => {
    const task = result.conditions.get("COMPLETE_ENTER_THE_NEW_DIMENSION_QUEST");
    expect(task?.type).toBe("task");
    expect(task?.quest).toBe("CA01");
    expect(task?.name.zh).toBe("進入裂隙");
  });

  it("names the boss from the mob name table", () => {
    const boss = result.conditions.get("DEFEAT_A_MONARCH");
    expect(boss?.type).toBe("boss");
    expect(boss?.quest).toBeUndefined();
    expect(boss?.name.zh).toBe("君主");
    expect(boss?.name.de).toBe("Monarch");
  });

  it("gives no condition for other condition types or achievements missing from the table", () => {
    expect(result.conditions.has("OPEN_100_CHESTS")).toBe(false);
    expect(result.conditions.has("NOT_IN_TABLE")).toBe(false);
    expect(result.issues).toContainEqual({ type: "missing-achievement-condition", detail: "NOT_IN_TABLE" });
    expect(result.issues).toContainEqual({ type: "missing-achievement-condition", detail: "OPEN_100_CHESTS" });
  });

  it("shows English and marks the language untranslated when a language has no text", () => {
    const locales = without(without(LOCALES, "ko", QUEST_LABELS, "CA00"), "zh", QUEST_LABELS, "CA00");
    const quest = buildConditions(parseAchievementDefinitions(ROWS, "x.json"), locales, ids).conditions.get("COMPLETE_ARRIVE_IN_BRAVE_HAVEN_QUEST");
    expect(quest?.name.ko).toBe("Escape from Squid Coast");
    expect(quest?.name.zh).toBe("Escape from Squid Coast");
    expect(quest?.untranslated).toEqual(["zh", "ko"]);
  });

  it("reports a condition whose name has no English text and leaves it out", () => {
    const locales = without(LOCALES, "en", QUEST_LABELS, "CA01_PC03");
    const built = buildConditions(parseAchievementDefinitions(ROWS, "x.json"), locales, ids);
    expect(built.conditions.has("COMPLETE_ENTER_THE_NEW_DIMENSION_QUEST")).toBe(false);
    expect(built.issues).toContainEqual({ type: "missing-achievement-condition", detail: "COMPLETE_ENTER_THE_NEW_DIMENSION_QUEST: QuestTrackerLabels.csv CA01_PC03" });
  });

  it("covers every language in each name", () => {
    for (const condition of result.conditions.values()) expect(Object.keys(condition.name).sort()).toEqual([...LANGS].sort());
  });
});

describe("loadAchievementDefinitions", () => {
  it("returns undefined when the table is not in source-data", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "mcd2-achdef-"));
    expect(await loadAchievementDefinitions(root)).toBeUndefined();
  });

  it("reads and validates the table", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "mcd2-achdef-"));
    const file = path.join(root, ...ACHIEVEMENT_DEFINITIONS_FILE.split("/"));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(ROWS), "utf8");
    expect((await loadAchievementDefinitions(root))?.length).toBe(4);
    await writeFile(file, JSON.stringify([{ AchievementId: 3 }]), "utf8");
    await expect(loadAchievementDefinitions(root)).rejects.toThrow(/DT_AchievementDefinition\.json/);
  });
});
