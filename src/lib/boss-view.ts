/**
 * The bosses page's list, derived from mobs.json, quests.json and locations.json. Pure; type-only imports.
 *
 * Story order: a boss a core quest features sorts by that quest's place in the core chain (and its place in the
 * quest's mob list); one with no core quest sorts after those, by the lowest player level of its first area's region;
 * one with neither goes last. Ties go by English name. Bosses come first, then mini-bosses, each ordered this way.
 */
import type { Location } from "../../scripts/extract/location-schema";
import type { Mob } from "../../scripts/extract/mob-schema";
import type { Quest } from "../../scripts/extract/quest-schema";

export const BOSS_KINDS = ["boss", "miniboss"] as const satisfies readonly Mob["kind"][];
export type BossKind = (typeof BOSS_KINDS)[number];

export interface BossView {
  readonly mob: Mob;
  /** Core quests that feature it, in chain order. */
  readonly coreQuests: readonly Quest[];
  /** Boss replays that feature it. */
  readonly replayQuests: readonly Quest[];
  /** The published locations of its areas, each once, in its area order. */
  readonly locations: readonly Location[];
}

export interface BossGroup {
  readonly kind: BossKind;
  readonly bosses: readonly BossView[];
}

type SortKey = readonly [tier: number, first: number, second: number];

const NO_LEVEL = Number.MAX_SAFE_INTEGER;

function sortKey(view: BossView, core: readonly Quest[]): SortKey {
  const quest = view.coreQuests[0];
  if (quest) return [0, core.indexOf(quest), quest.mobs.indexOf(view.mob.slug)];
  const level = view.locations[0]?.levels[0];
  return level === undefined ? [2, NO_LEVEL, 0] : [1, level, 0];
}

const compareKeys = (a: SortKey, b: SortKey): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

function viewOf(mob: Mob, quests: readonly Quest[], locationOf: (areaId: string) => Location | undefined): BossView {
  const features = (section: Quest["section"]) => quests.filter((quest) => quest.section === section && quest.mobs.includes(mob.slug));
  const locations = mob.areas.flatMap((area) => locationOf(area.areaId) ?? []);
  return { mob, coreQuests: features("core"), replayQuests: features("bossReplay"), locations: [...new Set(locations)] };
}

/** The boss and mini-boss groups in story order; an empty group is left out. `quests` must be in list order. */
export function bossGroups(mobs: readonly Mob[], quests: readonly Quest[], locationOf: (areaId: string) => Location | undefined): BossGroup[] {
  const core = quests.filter((quest) => quest.section === "core");
  return BOSS_KINDS.flatMap((kind) => {
    const views = mobs.filter((mob) => mob.kind === kind).map((mob) => viewOf(mob, quests, locationOf));
    const keyed = views.map((view) => ({ view, key: sortKey(view, core) }));
    const sorted = [...keyed].sort((a, b) => compareKeys(a.key, b.key) || a.view.mob.name.en.localeCompare(b.view.mob.name.en, "en"));
    return sorted.length === 0 ? [] : [{ kind, bosses: sorted.map(({ view }) => view) }];
  });
}

/** The mob's health stat, if the game gives one. */
export const healthOf = (mob: Mob): number | undefined => mob.stats.find((stat) => stat.key === "health")?.value;
