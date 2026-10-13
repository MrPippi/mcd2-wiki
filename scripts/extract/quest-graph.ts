/** Quest identity and order: slugs, list sections, sizes, the core chain, reverse prerequisite links and list order. */
import type { QuestSection, QuestSize, RawQuest } from "./quest-schema";

/** CA02_B → "ca02-b"; FOa1_S08_A → "foa1-s08-a". Stable: it depends on the quest id alone. */
export const questSlug = (id: string): string =>
  id
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part !== "")
    .join("-");

const BOSS_REPLAY = /_BR(?:_|$)/;
const ECHO_GOLEM = /^CT_/;

/** Core quests by quest_type; side quests split into boss replays (…_BR), Echo Golem quests (CT_…) and the rest. */
export function sectionOf(quest: Pick<RawQuest, "id" | "quest_type">): QuestSection {
  if (quest.quest_type === "CoreQuest") return "core";
  if (BOSS_REPLAY.test(quest.id)) return "bossReplay";
  if (ECHO_GOLEM.test(quest.id)) return "echoGolem";
  return "side";
}

const SIZES: Readonly<Record<string, QuestSize>> = {
  "sw.questsize.small": "small",
  "sw.questsize.medium": "medium",
  "sw.questsize.large": "large",
  "sw.questsize.extralarge": "extraLarge",
};

/** SW.QuestSize.ExtraLarge → "extraLarge"; an unknown tag → undefined. */
export const sizeOf = (tag: string): QuestSize | undefined => (Object.hasOwn(SIZES, tag.toLowerCase()) ? SIZES[tag.toLowerCase()] : undefined);

interface Linked {
  readonly id: string;
  readonly prerequisites: readonly string[];
}

/**
 * Ids in prerequisite order: a quest comes after every quest it requires that is in the list; among quests that are
 * ready at the same time the input order wins. Quests caught in a cycle follow at the end, in input order.
 */
export function chainOrder(quests: readonly Linked[]): string[] {
  const ids = new Set(quests.map((quest) => quest.id));
  const placed: string[] = [];
  const done = new Set<string>();
  const ready = (quest: Linked): boolean => !done.has(quest.id) && quest.prerequisites.every((id) => !ids.has(id) || done.has(id));
  for (let next = quests.find(ready); next !== undefined; next = quests.find(ready)) {
    placed.push(next.id);
    done.add(next.id);
  }
  return [...placed, ...quests.filter((quest) => !done.has(quest.id)).map((quest) => quest.id)];
}

/** Quest id → the ids of the quests that list it as a prerequisite, in input order. */
export function unlocksOf(quests: readonly Linked[]): ReadonlyMap<string, string[]> {
  const result = new Map<string, string[]>();
  for (const quest of quests) {
    for (const required of quest.prerequisites) result.set(required, [...(result.get(required) ?? []), quest.id]);
  }
  return result;
}

export interface Progress {
  /** Index in the core chain of the core quest this quest hangs off (the core quest itself for a core quest). */
  readonly anchor: number;
  /** Steps from that core quest. */
  readonly hops: number;
}

/**
 * Where each quest sits in the story: follow the first prerequisite until a core quest. A quest with no way back to the
 * core chain sorts after it.
 */
export function progressOf(quests: readonly Linked[], coreChain: readonly string[]): ReadonlyMap<string, Progress> {
  const byId = new Map(quests.map((quest) => [quest.id, quest]));
  const progress = (id: string, seen: ReadonlySet<string>): Progress => {
    const core = coreChain.indexOf(id);
    if (core !== -1) return { anchor: core, hops: 0 };
    const parent = byId.get(id)?.prerequisites[0];
    if (parent === undefined || seen.has(parent)) return { anchor: coreChain.length, hops: 0 };
    const above = progress(parent, new Set([...seen, id]));
    return { anchor: above.anchor, hops: above.hops + 1 };
  };
  return new Map(quests.map((quest) => [quest.id, progress(quest.id, new Set())]));
}

/** Story order: by anchor, then hops, then id. */
export const byProgress =
  (progress: ReadonlyMap<string, Progress>) =>
  (a: string, b: string): number => {
    const pa = progress.get(a) ?? { anchor: Infinity, hops: 0 };
    const pb = progress.get(b) ?? { anchor: Infinity, hops: 0 };
    return pa.anchor - pb.anchor || pa.hops - pb.hops || (a < b ? -1 : a > b ? 1 : 0);
  };
