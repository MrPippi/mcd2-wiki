/** Builds src/data/drop-models.json: reads the tables the drop odds need (drop-models.ts says what the model is) and joins them to the finished bestiary, quests and guides. */
import { buildDropModels, NO_DROPS } from "./drop-models";
import { loadDropTables } from "./drop-tables";
import type { ThreatRow } from "./guides-schema";
import { issue, type Issue } from "./issues";
import { loadLootTables } from "./loot-tables";
import type { ItemSourcesData, MobData } from "./mob-schema";
import { tagKey } from "./mob-tags";
import type { QuestData } from "./quest-schema";
import { loadQuestTables } from "./quest-tables";
import type { Entry } from "./schemas";
import type { DropFile } from "../../src/lib/drop-types";

export interface DropsInput {
  readonly sourceRoot: string;
  readonly entries: readonly Entry[];
  readonly threat: readonly ThreatRow[];
  /** loot-sources.json, already built. */
  readonly sources: ItemSourcesData;
  readonly quests: QuestData;
  readonly mobs: MobData;
  /** Mob tag → bestiary slug (the bestiary links). */
  readonly tagIndex: ReadonlyMap<string, string>;
}

export interface DropsResult {
  readonly data: DropFile;
  readonly issues: Issue[];
  readonly tablesRead: readonly string[];
}

/** Mob slug → every tag a bestiary row of it goes by. */
function mobTagsOf(tagIndex: ReadonlyMap<string, string>): Map<string, string[]> {
  const bySlug = new Map<string, string[]>();
  for (const [tag, slug] of tagIndex) bySlug.set(slug, [...(bySlug.get(slug) ?? []), tag]);
  return bySlug;
}

export async function extractDrops(input: DropsInput): Promise<DropsResult> {
  const tablesRead: string[] = [];
  const onRead = (file: string): void => {
    tablesRead.push(file);
  };
  const loot = await loadLootTables(input.sourceRoot, onRead);
  const { tables, missing } = await loadDropTables(input.sourceRoot, onRead);
  const quests = await loadQuestTables(input.sourceRoot, onRead);
  if (!loot || !tables) {
    const absent = loot ? missing : ["DT_LootSourceDefinition_Area.json", ...missing];
    return { data: NO_DROPS, issues: absent.map((file) => issue("missing-drop-tables", file)), tablesRead };
  }
  const built = buildDropModels({
    loot,
    tables,
    entries: input.entries,
    threat: input.threat,
    sources: input.sources,
    quests: quests.tables?.quests ?? [],
    publishedQuests: new Set(input.quests.quests.map((quest) => quest.id)),
    mobs: input.mobs,
    mobTags: new Map([...mobTagsOf(input.tagIndex)].map(([slug, tags]) => [slug, tags.map(tagKey)])),
  });
  return { data: built.data, issues: [...quests.issues, ...built.issues], tablesRead };
}
