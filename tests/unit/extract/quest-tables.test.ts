import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadQuestTables, parseLibraries, parseLibrary, QUEST_TABLE_FILES } from "../../../scripts/extract/quest-tables";
import { group, libraryRow, rawQuest, SIZE_ROWS, task } from "../../helpers/quest-tables";

async function sourceWith(tables: Record<string, unknown>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "mcd2-quests-"));
  const dir = path.join(root, "DataTables", "UFS");
  await mkdir(dir, { recursive: true });
  for (const [name, rows] of Object.entries(tables)) await writeFile(path.join(dir, `${name}.json`), JSON.stringify(rows), "utf8");
  return root;
}

const CA00 = rawQuest({ id: "CA00", type: "CoreQuest", goals: group("CA00_Sequence01", [task("CA00_E01")]) });

describe("parseLibrary", () => {
  it("parses the RawQuestData string and keeps the goal tree", () => {
    const parsed = parseLibrary(libraryRow("Core_Quests", [CA00]));
    expect(parsed.issues).toEqual([]);
    expect(parsed.quests).toHaveLength(1);
    expect(parsed.quests[0]?.library).toBe("Core_Quests");
    expect(parsed.quests[0]?.quest.goals?.subgoals?.[0]?.name).toBe("CA00_E01");
  });
  it("reports a library whose JSON does not parse", () => {
    expect(parseLibrary({ Name: "Broken", RawQuestData: "{not json" })).toEqual({ quests: [], issues: [{ type: "quest-library-invalid", detail: "Broken: RawQuestData" }] });
  });
  it("reports a library without a quest list", () => {
    expect(parseLibrary({ Name: "Empty", RawQuestData: "{}" }).issues).toEqual([{ type: "quest-library-invalid", detail: "Empty: RawQuestData" }]);
  });
  it("reports a quest that does not match and keeps the others", () => {
    const parsed = parseLibrary(libraryRow("Forest_Quests", [CA00, { id: "BAD" } as never]));
    expect(parsed.quests.map((one) => one.quest.id)).toEqual(["CA00"]);
    expect(parsed.issues[0]?.type).toBe("quest-library-invalid");
    expect(parsed.issues[0]?.detail).toMatch(/^Forest_Quests #1: /);
  });
});

describe("parseLibraries", () => {
  it("joins the libraries in table order", () => {
    const parsed = parseLibraries([libraryRow("A", [CA00]), { Name: "B", RawQuestData: "" }, libraryRow("C", [rawQuest({ id: "S1" })])]);
    expect(parsed.quests.map((one) => one.quest.id)).toEqual(["CA00", "S1"]);
    expect(parsed.issues).toHaveLength(1);
  });
});

describe("loadQuestTables", () => {
  it("reads the four tables through the reader and reports what it read", async () => {
    const root = await sourceWith({
      DT_QuestLibraries: [libraryRow("Core_Quests", [CA00])],
      DT_LootSourceDefinition_Quest: SIZE_ROWS,
      DT_ArenaFightDefinition: [{ TypeTag: { TagName: "SW.ArenaSetup.X" }, ArenaFightsDefinition: { SpawnWaveDefinition: { TagName: "SW.ArenaWave.X" } } }],
      DT_SpawnWaveDefinition: [{ TypeTag: { TagName: "SW.ArenaWave.X" }, SpawnWaveDefinition: { Waves: [{ Waves: [{ MobType: { TagName: "SW.Mob.Maw" } }] }] } }],
    });
    const read: string[] = [];
    const loaded = await loadQuestTables(root, (file) => read.push(file));
    expect(loaded.issues).toEqual([]);
    expect(loaded.tables?.quests).toHaveLength(1);
    expect(loaded.tables?.loot).toHaveLength(3);
    expect(read.sort()).toEqual(Object.values(QUEST_TABLE_FILES).map((name) => `${name}.json`).sort());
  });
  it("has no tables without the quest libraries", async () => {
    const loaded = await loadQuestTables(await sourceWith({}));
    expect(loaded.tables).toBeUndefined();
    expect(loaded.issues).toEqual([{ type: "missing-quest-tables", detail: "DT_QuestLibraries.json" }]);
  });
  it("keeps going without the optional tables and names them", async () => {
    const loaded = await loadQuestTables(await sourceWith({ DT_QuestLibraries: [libraryRow("Core_Quests", [CA00])] }));
    expect(loaded.tables?.arenas).toEqual([]);
    expect(loaded.issues.map((one) => one.detail)).toEqual(["DT_LootSourceDefinition_Quest.json", "DT_ArenaFightDefinition.json", "DT_SpawnWaveDefinition.json"]);
  });
  it("fails with the file name when a table row does not match", async () => {
    const root = await sourceWith({ DT_QuestLibraries: [{ Name: "Core_Quests", RawQuestData: 42 }] });
    await expect(loadQuestTables(root)).rejects.toThrow(/DT_QuestLibraries/);
  });
});
