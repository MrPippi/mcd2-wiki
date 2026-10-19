/** Builds src/data/quests.json: every published quest in list order, linked by prerequisites, plus the item-page reward links. */
import type { BestiaryLinks } from "./bestiary";
import type { Lang } from "../../shared/config";
import { issue, type Issue } from "./issues";
import type { MapData } from "../../shared/map-schema";
import { areaMarkers, buildAreaNamer } from "./mob-areas";
import type { ItemSourcesData, MobData } from "../../shared/mob-schema";
import { arenaMobIndex } from "./quest-arenas";
import { draftQuest, skipReason, type DraftContext, type QuestDraft } from "./quest-draft";
import { byProgress, chainOrder, progressOf, questSlug, unlocksOf } from "../../shared/quest-graph";
import { itemsBySource, questSourceId, rewardRowNames, rowsByTag } from "./quest-rewards";
import { EMPTY_QUESTS, QuestDataSchema, type Quest, type QuestData, type RawQuest } from "../../shared/quest-schema";
import { loadQuestTables, type QuestTables } from "./quest-tables";
import type { LocaleFile } from "../../shared/schemas";

export interface QuestsInput {
  readonly sourceRoot: string;
  readonly locales: Readonly<Record<Lang, LocaleFile>>;
  /** loot-sources.json, already built. */
  readonly sources: ItemSourcesData;
  readonly links: BestiaryLinks;
  readonly mobs: MobData;
  readonly map: MapData;
}

export interface QuestsResult {
  readonly data: QuestData;
  readonly issues: Issue[];
  readonly tablesRead: readonly string[];
}

interface Kept {
  readonly raw: RawQuest;
  readonly draft: QuestDraft;
  /** Prerequisite ids that are published quests. */
  readonly prerequisites: readonly string[];
}

/** Prerequisites limited to published quests; one that is no quest at all, or a quest left out, is dropped and reported. */
function linkPrerequisites(raw: RawQuest, keptIds: ReadonlySet<string>, allIds: ReadonlySet<string>): { ids: string[]; issues: Issue[] } {
  const unknown = raw.prerequisites.filter((id) => !allIds.has(id));
  const skipped = raw.prerequisites.filter((id) => allIds.has(id) && !keptIds.has(id));
  return {
    ids: raw.prerequisites.filter((id) => keptIds.has(id)),
    issues: [
      ...unknown.map((id) => issue("quest-prerequisite-unknown", `${raw.id} → ${id}`)),
      ...skipped.map((id) => issue("quest-prerequisite-skipped", `${raw.id} → ${id}`)),
    ],
  };
}

/** List order: the core chain, side quests grouped by region (regions in story order), Echo Golem quests, boss replays. */
export function listOrder(kept: readonly Kept[]): Kept[] {
  const linked = kept.map((quest) => ({ id: quest.raw.id, prerequisites: quest.prerequisites }));
  const chain = chainOrder(linked.filter((quest) => kept.find((one) => one.raw.id === quest.id)?.draft.section === "core"));
  const compare = byProgress(progressOf(linked, chain));
  const byId = new Map(kept.map((quest) => [quest.raw.id, quest]));
  const inSection = (section: Quest["section"]): Kept[] =>
    kept.filter((quest) => quest.draft.section === section).sort((a, b) => compare(a.raw.id, b.raw.id));
  const sides = inSection("side");
  const regions = [...new Set(sides.map((quest) => quest.draft.region?.areaId ?? ""))];
  return [
    ...chain.flatMap((id) => byId.get(id) ?? []),
    ...regions.flatMap((region) => sides.filter((quest) => (quest.draft.region?.areaId ?? "") === region)),
    ...inSection("echoGolem"),
    ...inSection("bossReplay"),
  ];
}

/** Quest loot rows → the published quests that give them; a row that a left-out quest also gives is not exactly known and is left out. */
export function rewardSourcesOf(all: readonly RawQuest[], keptIds: ReadonlySet<string>, ctx: DraftContext): QuestData["rewardSources"] {
  const givers = new Map<string, string[]>();
  for (const quest of all) for (const row of rewardRowNames(quest, ctx.rewards.rowsByTag)) givers.set(row, [...(givers.get(row) ?? []), quest.id]);
  return Object.fromEntries(
    [...givers]
      .filter(([row, ids]) => ctx.rewards.items.has(questSourceId(row)) && ids.every((id) => keptIds.has(id)))
      .map(([row, ids]) => [questSourceId(row), ids.map(questSlug)] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

function contextFor(tables: QuestTables, input: QuestsInput): { ctx: DraftContext; issues: Issue[] } {
  const namer = buildAreaNamer(input.links.areas, input.locales);
  const arenas = arenaMobIndex(tables.arenas, tables.waves, tables.spawns);
  const ctx: DraftContext = {
    locales: input.locales,
    rewards: { rowsByTag: rowsByTag(tables.loot), items: itemsBySource(input.sources), namer },
    namer,
    markers: areaMarkers(input.map),
    tagIndex: input.links.tagIndex,
    mobs: input.mobs,
    arenaMobs: arenas.mobsOf,
  };
  return { ctx, issues: arenas.issues };
}

/** The quest data from parsed tables; every left-out quest and every gap is an issue. */
export function buildQuestData(tables: QuestTables, input: QuestsInput): { data: QuestData; issues: Issue[] } {
  const { ctx, issues: arenaIssues } = contextFor(tables, input);
  const all = tables.quests.map((one) => one.quest);
  const reasons = all.map((quest) => ({ quest, reason: skipReason(quest, input.locales) }));
  const keptRaw = reasons.flatMap(({ quest, reason }) => (reason === undefined ? [quest] : []));
  const keptIds = new Set(keptRaw.map((quest) => quest.id));
  const allIds = new Set(all.map((quest) => quest.id));
  const drafted = keptRaw.map((raw) => ({ raw, built: draftQuest(raw, ctx), links: linkPrerequisites(raw, keptIds, allIds) }));
  const ordered = listOrder(drafted.map(({ raw, built, links }) => ({ raw, draft: built.draft, prerequisites: links.ids })));
  const unlocks = unlocksOf(ordered.map((quest) => ({ id: quest.raw.id, prerequisites: quest.prerequisites })));
  const quests = ordered.map((quest) => ({
    ...quest.draft,
    prerequisites: quest.prerequisites.map(questSlug),
    unlocks: (unlocks.get(quest.raw.id) ?? []).map(questSlug),
  }));
  const data = QuestDataSchema.parse({ quests, rewardSources: rewardSourcesOf(all, keptIds, ctx) });
  const issues = [
    ...reasons.flatMap(({ quest, reason }) => (reason === undefined ? [] : [issue("quest-skipped", `${quest.id}: ${reason}`)])),
    ...drafted.flatMap(({ built, links }) => [...built.issues, ...links.issues]),
    ...arenaIssues,
  ];
  return { data, issues };
}

export async function extractQuests(input: QuestsInput): Promise<QuestsResult> {
  const tablesRead: string[] = [];
  const loaded = await loadQuestTables(input.sourceRoot, (file) => {
    tablesRead.push(file);
  });
  if (!loaded.tables) return { data: EMPTY_QUESTS, issues: loaded.issues, tablesRead };
  const built = buildQuestData(loaded.tables, input);
  return { data: built.data, issues: [...loaded.issues, ...built.issues], tablesRead };
}
