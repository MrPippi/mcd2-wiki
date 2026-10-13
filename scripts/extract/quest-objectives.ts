/** Walks a quest's goal tree: the labelled objectives a player sees, and the mob and arena tags its tasks name. */
import type { RawGoal } from "./quest-schema";

export interface GoalObjective {
  /** The goal name, which is also its QuestTrackerLabels key. */
  readonly key: string;
  readonly count: number;
}

/**
 * How many times the objective must be done. A group that shows progress counts its direct subgoals (the game's
 * "completed/total"); any other group counts once. A task counts its kill_count, else its howmany_count, else once.
 */
export function goalCount(goal: RawGoal): number {
  if (goal.subgoals) return goal.show_progress ? Math.max(goal.subgoals.length, 1) : 1;
  return Math.max(goal.kill_count ?? goal.howmany_count ?? 1, 1);
}

/** Labelled goals in tree order. A labelled group is one objective and is not entered; unlabelled nodes are internal. */
export function labelledGoals(goal: RawGoal | undefined, hasLabel: (key: string) => boolean): GoalObjective[] {
  if (!goal) return [];
  if (hasLabel(goal.name)) return [{ key: goal.name, count: goalCount(goal) }];
  return (goal.subgoals ?? []).flatMap((child) => labelledGoals(child, hasLabel));
}

/** Every goal in tree order. */
function allGoals(goal: RawGoal | undefined): RawGoal[] {
  return goal ? [goal, ...(goal.subgoals ?? []).flatMap(allGoals)] : [];
}

/** The mob tags the tasks kill or spawn, in tree order, each once. */
export const goalMobTags = (goal: RawGoal | undefined): string[] => [
  ...new Set(allGoals(goal).flatMap((node) => [...(node.kill_target_types ?? []), ...(node.mob_types ?? [])])),
];

/** The arena setups the tasks fight in, in tree order, each once. */
export const goalArenaTags = (goal: RawGoal | undefined): string[] => [
  ...new Set(allGoals(goal).flatMap((node) => (node.arena_tag ? [node.arena_tag] : []))),
];

/**
 * Runs of the same objective (same text and count, one right after another) shown once. A step that comes back later
 * in the quest is a real step and stays. `textOf` gives the text they compare by.
 */
export function dedupeObjectives<T extends GoalObjective>(objectives: readonly T[], textOf: (objective: T) => string): T[] {
  const same = (a: T, b: T): boolean => textOf(a) === textOf(b) && a.count === b.count;
  return objectives.filter((objective, index) => index === 0 || !same(objective, objectives[index - 1]));
}
