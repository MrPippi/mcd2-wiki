/** One quest page from one library quest: texts, region, objectives, rewards and related mobs. Links between quests come later. */
import type { Lang } from "./config";
import { issue, type Issue } from "./issues";
import { areaPrefix, type AreaMarker, type AreaNamer } from "./mob-areas";
import type { MobArea, MobData } from "./mob-schema";
import { normalizeTag, tagKey } from "./mob-tags";
import { questSlug, sectionOf, sizeOf } from "./quest-graph";
import { dedupeObjectives, goalArenaTags, goalMobTags, labelledGoals } from "./quest-objectives";
import { emeraldsOf, rewardsOf, type RewardContext } from "./quest-rewards";
import type { Quest, RawQuest } from "./quest-schema";
import type { ArenaRow, WaveRow } from "./quest-tables";
import { descriptionIsCompletedText, hasLabel, QUEST_COMPLETED, QUEST_DESCRIPTIONS, QUEST_LABELS, questHtml, questText } from "./quest-texts";
import type { LocaleFile } from "./schemas";

type Locales = Readonly<Record<Lang, LocaleFile>>;

export interface DraftContext {
  readonly locales: Locales;
  readonly rewards: RewardContext;
  readonly namer: AreaNamer;
  readonly markers: ReadonlyMap<string, AreaMarker>;
  /** Mob tag key → bestiary slug. */
  readonly tagIndex: ReadonlyMap<string, string>;
  readonly mobs: MobData;
  /** Arena setup tag → the mob tags of its spawn waves. */
  readonly arenaMobs: (arenaTag: string) => readonly string[];
}

/** A quest page before prerequisites and unlocks are turned into slugs. */
export type QuestDraft = Omit<Quest, "prerequisites" | "unlocks">;

/** The whole-area tag (SW.Area) names no place: quests that carry it have no region. */
const NO_REGION = "sw.area";
const KIND_ORDER: readonly MobData["mobs"][number]["kind"][] = ["boss", "miniboss", "regular", "variant"];

/** Why a quest is left out, or undefined to keep it: no usable title (CA04_BR, TOa1_S01_A's "ERROR"), or an "ERROR" description. */
export function skipReason(quest: RawQuest, locales: Locales): string | undefined {
  if (!hasLabel(locales, quest.id)) return quest.initial_state === "Unavailable" ? "unavailable, no title" : "no title";
  const description = locales.en[QUEST_DESCRIPTIONS]?.[quest.id];
  if (description !== undefined && description.trim() === "ERROR") return "description is ERROR";
  return undefined;
}

/** Arena setup tag → mob tags, through the arena's spawn-wave definition. */
export function arenaMobIndex(arenas: readonly ArenaRow[], waves: readonly WaveRow[]): (arenaTag: string) => readonly string[] {
  const waveMobs = new Map<string, string[]>();
  for (const wave of waves) {
    if (!wave.TypeTag || waveMobs.has(tagKey(wave.TypeTag.TagName))) continue;
    const mobs = (wave.SpawnWaveDefinition?.Waves ?? []).flatMap((step) => (step.Waves ?? []).map((spawn) => spawn.MobType.TagName));
    waveMobs.set(tagKey(wave.TypeTag.TagName), [...new Set(mobs)]);
  }
  const byArena = new Map<string, readonly string[]>();
  for (const arena of arenas) {
    const wave = arena.ArenaFightsDefinition?.SpawnWaveDefinition?.TagName;
    if (!byArena.has(tagKey(arena.TypeTag.TagName))) byArena.set(tagKey(arena.TypeTag.TagName), wave ? (waveMobs.get(tagKey(wave)) ?? []) : []);
  }
  return (arenaTag) => byArena.get(tagKey(arenaTag)) ?? [];
}

function regionOf(tag: string, ctx: DraftContext, id: string): { region: MobArea | null; issues: Issue[] } {
  if (tagKey(tag) === NO_REGION) return { region: null, issues: [] };
  const name = ctx.namer(tag);
  if (!name) return { region: null, issues: [issue("quest-area-unnamed", `${id}: ${tag}`)] };
  const marker = ctx.markers.get(tagKey(areaPrefix(tag)));
  return { region: { areaId: normalizeTag(tag), name, ...(marker ? { map: { world: marker.world, px: marker.px, py: marker.py } } : {}) }, issues: [] };
}

function objectivesOf(quest: RawQuest, locales: Locales): Quest["objectives"] {
  const goals = labelledGoals(quest.goals, (key) => hasLabel(locales, key));
  const texts = goals.flatMap((goal) => {
    const found = questText(locales, QUEST_LABELS, goal.key);
    return found ? [{ key: goal.key, count: goal.count, ...found }] : [];
  });
  return dedupeObjectives(texts, (objective) => objective.text.en).map(({ text, untranslated, count }) => ({ text, untranslated, count }));
}

/**
 * Bestiary slugs of the mobs the tasks and arenas name: bosses first, then by English name. Tags with no bestiary
 * page (no slug, or a slug with no mob entry) come back as unlinked, so the caller reports them.
 */
export function mobsOf(quest: RawQuest, ctx: DraftContext): { slugs: string[]; unlinked: string[] } {
  const tags = [...new Set([...goalMobTags(quest.goals), ...goalArenaTags(quest.goals).flatMap(ctx.arenaMobs)])];
  const bySlug = new Map(ctx.mobs.mobs.map((mob) => [mob.slug, mob]));
  const slugOf = (tag: string): string | undefined => ctx.tagIndex.get(tagKey(tag));
  const unlinked = tags.filter((tag) => {
    const slug = slugOf(tag);
    return slug === undefined || !bySlug.has(slug);
  });
  const slugs = [...new Set(tags.flatMap((tag) => slugOf(tag) ?? []))];
  const rank = (slug: string): number => KIND_ORDER.indexOf(bySlug.get(slug)?.kind ?? "variant");
  const name = (slug: string): string => bySlug.get(slug)?.name.en ?? slug;
  const sorted = slugs.filter((slug) => bySlug.has(slug)).sort((a, b) => rank(a) - rank(b) || name(a).localeCompare(name(b), "en"));
  return { slugs: sorted, unlinked };
}

/** The page for a kept quest (see skipReason), with every gap reported. */
export function draftQuest(quest: RawQuest, ctx: DraftContext): { draft: QuestDraft; issues: Issue[] } {
  const title = questText(ctx.locales, QUEST_LABELS, quest.id);
  if (!title) throw new Error(`quest ${quest.id} has no title; skipReason keeps such quests out`);
  const description = questHtml(ctx.locales, QUEST_DESCRIPTIONS, quest.id, descriptionIsCompletedText(ctx.locales, quest.id)) ?? null;
  const completed = questHtml(ctx.locales, QUEST_COMPLETED, quest.id) ?? null;
  const region = regionOf(quest.RewardData.areaRewardScalingTag.tagName, ctx, quest.id);
  const first = rewardsOf(quest.RewardData.firstCompletionLootSourceData, ctx.rewards, `${quest.id} first`);
  const every = rewardsOf(quest.RewardData.lootSourceData, ctx.rewards, `${quest.id} every`);
  const mobs = mobsOf(quest, ctx);
  const size = sizeOf(quest.RewardData.questSize.tagName);
  const draft: QuestDraft = {
    slug: questSlug(quest.id),
    id: quest.id,
    section: sectionOf(quest),
    type: quest.quest_type === "CoreQuest" ? "core" : "side",
    size: size ?? null,
    replayable: quest.is_replayable,
    title,
    description,
    completed,
    region: region.region,
    objectives: objectivesOf(quest, ctx.locales),
    rewards: { first: first.rewards, every: every.rewards, emeralds: emeraldsOf(quest.RewardData.questSize.tagName, ctx.rewards.rowsByTag) },
    mobs: mobs.slugs,
  };
  const issues = [
    ...(description ? [] : [issue("quest-text-missing", `${quest.id}: QuestDescriptions`)]),
    ...(completed ? [] : [issue("quest-text-missing", `${quest.id}: QuestDescriptionsCompleted`)]),
    ...(size ? [] : [issue("quest-size-unknown", `${quest.id}: ${quest.RewardData.questSize.tagName}`)]),
    ...region.issues,
    ...first.issues,
    ...every.issues,
    ...(mobs.unlinked.length > 0 ? [issue("quest-mob-unlinked", `${quest.id}: ${mobs.unlinked.join(", ")}`)] : []),
  ];
  return { draft, issues };
}
