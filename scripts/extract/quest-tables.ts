/**
 * The DataTables the quest pages read: the quest libraries, the quest loot rows, and the arena → spawn-wave chain that
 * names the mobs of each quest arena. Table rows are validated so a game update fails loudly; a quest library whose
 * RawQuestData does not parse is reported and left out instead.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DATATABLES_DIR } from "./game-tables";
import { ExtractError, formatZodIssue, issue, type Issue } from "./issues";
import { LootTablesSchema, type LootRow } from "./loot-tables";
import { QuestLibraryRowSchema, RawQuestSchema, type RawQuest } from "./quest-schema";
import { readDataTable } from "./table-reader";

export const QUEST_TABLE_FILES = {
  libraries: "DT_QuestLibraries",
  loot: "DT_LootSourceDefinition_Quest",
  arenas: "DT_ArenaFightDefinition",
  waves: "DT_SpawnWaveDefinition",
} as const;

const Tag = z.looseObject({ TagName: z.string() });
const ArenaRowSchema = z.looseObject({
  TypeTag: Tag,
  ArenaFightsDefinition: z.looseObject({ SpawnWaveDefinition: Tag.optional() }).optional(),
});
const WaveRowSchema = z.looseObject({
  TypeTag: Tag.optional(),
  SpawnWaveDefinition: z
    .looseObject({ Waves: z.array(z.looseObject({ Waves: z.array(z.looseObject({ MobType: Tag })).optional() })).optional() })
    .optional(),
});

const TablesSchema = z.object({
  libraries: z.array(QuestLibraryRowSchema),
  loot: LootTablesSchema.shape.quest,
  arenas: z.array(ArenaRowSchema),
  waves: z.array(WaveRowSchema),
});
type RawTables = z.infer<typeof TablesSchema>;
export type ArenaRow = RawTables["arenas"][number];
export type WaveRow = RawTables["waves"][number];

/** A quest with the library row it came from. */
export interface LibraryQuest {
  readonly library: string;
  readonly quest: RawQuest;
}

export interface QuestTables {
  readonly quests: readonly LibraryQuest[];
  readonly loot: readonly LootRow[];
  readonly arenas: readonly ArenaRow[];
  readonly waves: readonly WaveRow[];
}

type Key = keyof typeof QUEST_TABLE_FILES;
const KEYS = ["libraries", "loot", "arenas", "waves"] as const satisfies readonly Key[];

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const zodDetail = (error: z.ZodError): string => error.issues.slice(0, 2).map(formatZodIssue).join("；");

/** One library's quests; a library whose JSON does not parse, or a quest that does not match, becomes an issue. */
export function parseLibrary(row: z.infer<typeof QuestLibraryRowSchema>): { quests: LibraryQuest[]; issues: Issue[] } {
  const parsed = parseJson(row.RawQuestData);
  const list = z.looseObject({ Quests: z.array(z.unknown()) }).safeParse(parsed);
  if (!list.success) return { quests: [], issues: [issue("quest-library-invalid", `${row.Name}: RawQuestData`)] };
  const results = list.data.Quests.map((raw, index) => ({ index, result: RawQuestSchema.safeParse(raw) }));
  return {
    quests: results.flatMap(({ result }) => (result.success ? [{ library: row.Name, quest: result.data }] : [])),
    issues: results.flatMap(({ index, result }) => (result.success ? [] : [issue("quest-library-invalid", `${row.Name} #${index}: ${zodDetail(result.error)}`)])),
  };
}

/** Every library's quests, in table order. */
export function parseLibraries(rows: RawTables["libraries"]): { quests: LibraryQuest[]; issues: Issue[] } {
  const parsed = rows.map(parseLibrary);
  return { quests: parsed.flatMap((one) => one.quests), issues: parsed.flatMap((one) => one.issues) };
}

function parseTables(rowsByKey: Readonly<Record<Key, readonly unknown[]>>): RawTables {
  const failures = KEYS.flatMap((key) => {
    const parsed = TablesSchema.shape[key].safeParse(rowsByKey[key]);
    return parsed.success ? [] : [`資料表 ${QUEST_TABLE_FILES[key]}（${key}）欄位與預期不符（遊戲更新了格式？）：${zodDetail(parsed.error)}`];
  });
  if (failures.length > 0) throw new ExtractError(failures.join("\n"));
  return TablesSchema.parse(rowsByKey);
}

export interface LoadedQuestTables {
  readonly tables?: QuestTables;
  readonly issues: Issue[];
}

/** Reads the quest tables; `tables` is undefined (and reported) when the quest libraries are missing. */
export async function loadQuestTables(sourceRoot: string, onRead?: (file: string) => void): Promise<LoadedQuestTables> {
  const dir = path.join(sourceRoot, ...DATATABLES_DIR.split("/"));
  const present = (key: Key): boolean => existsSync(path.join(dir, `${QUEST_TABLE_FILES[key]}.json`));
  if (!present("libraries")) return { issues: [issue("missing-quest-tables", `${QUEST_TABLE_FILES.libraries}.json`)] };
  const missing = KEYS.filter((key) => !present(key));
  const rows = await Promise.all(KEYS.map((key) => (present(key) ? readDataTable(dir, QUEST_TABLE_FILES[key], onRead) : Promise.resolve([]))));
  const raw = parseTables({ libraries: rows[0], loot: rows[1], arenas: rows[2], waves: rows[3] });
  const libraries = parseLibraries(raw.libraries);
  return {
    tables: { quests: libraries.quests, loot: raw.loot, arenas: raw.arenas, waves: raw.waves },
    issues: [...missing.map((key) => issue("missing-quest-tables", `${QUEST_TABLE_FILES[key]}.json`)), ...libraries.issues],
  };
}
