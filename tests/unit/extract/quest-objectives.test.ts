import { describe, expect, it } from "vitest";
import { dedupeObjectives, goalArenaTags, goalCount, goalMobTags, labelledGoals } from "../../../scripts/extract/quest-objectives";
import { group, task } from "../../helpers/quest-tables";

// Shaped like PLa1_S04_A: a labelled group of three unlabelled interactions, spawn markers, repeated labels.
const BEES = group("S04_Sequence01", [
  task("S04_E01", { destination: "x" } as never),
  group("S04_Standard01", [task("S04_I01", { howmany_count: 1 }), task("S04_I02", { howmany_count: 1 }), task("S04_I03", { howmany_count: 1 })], { type: "Standard", show_progress: true }),
  task("S04_SM01", { mob_types: ["SW.Mob.Zombie", "SW.Mob.Creeper"] }),
  task("S04_K01", { kill_count: 3, kill_target_types: ["SW.Mob.Creeper", "SW.Mob.Zombie"] }),
  task("S04_E02"),
  task("S04_K02", { kill_count: 3, kill_target_types: ["SW.Mob.Zombie"] }),
  task("S04_AS01", { arena_tag: "SW.ArenaSetup.Plains.A1" }),
  task("S04_AS02", { arena_tag: "SW.ArenaSetup.Plains.A1" }),
]);
const LABELS = new Set(["S04_E01", "S04_Standard01", "S04_K01", "S04_E02", "S04_K02"]);

describe("goalCount", () => {
  it("counts a group that shows progress by its direct subgoals", () => {
    expect(goalCount(group("g", [task("a"), task("b"), task("c")], { show_progress: true }))).toBe(3);
  });
  it("counts any other group once", () => {
    expect(goalCount(group("g", [task("a"), task("b")], { show_progress: false }))).toBe(1);
    expect(goalCount(group("g", [], { show_progress: true }))).toBe(1);
  });
  it("counts a task by kill_count, then howmany_count, else once", () => {
    expect(goalCount(task("k", { kill_count: 6, howmany_count: 2 }))).toBe(6);
    expect(goalCount(task("i", { howmany_count: 4 }))).toBe(4);
    expect(goalCount(task("e"))).toBe(1);
    expect(goalCount(task("z", { kill_count: 0 }))).toBe(1);
  });
});

describe("labelledGoals", () => {
  it("flattens labelled goals in tree order and does not enter a labelled group", () => {
    expect(labelledGoals(BEES, (key) => LABELS.has(key))).toEqual([
      { key: "S04_E01", count: 1 },
      { key: "S04_Standard01", count: 3 },
      { key: "S04_K01", count: 3 },
      { key: "S04_E02", count: 1 },
      { key: "S04_K02", count: 3 },
    ]);
  });
  it("gives nothing for a quest without goals", () => {
    expect(labelledGoals(undefined, () => true)).toEqual([]);
  });
});

describe("dedupeObjectives", () => {
  it("collapses a run of the same objective with the same count", () => {
    const text: Record<string, string> = { a: "Rescue the foragers", b: "Rescue the foragers", c: "Rescue the foragers", d: "Wait" };
    const objectives = [{ key: "a", count: 1 }, { key: "b", count: 1 }, { key: "c", count: 2 }, { key: "d", count: 1 }];
    expect(dedupeObjectives(objectives, (objective) => text[objective.key])).toEqual([{ key: "a", count: 1 }, { key: "c", count: 2 }, { key: "d", count: 1 }]);
  });
  it("keeps a step that comes back later in the quest", () => {
    const text: Record<string, string> = { a: "Speak to the Blacksmith", b: "Recover the axes", c: "Speak to the Blacksmith" };
    const objectives = [{ key: "a", count: 1 }, { key: "b", count: 2 }, { key: "c", count: 1 }];
    expect(dedupeObjectives(objectives, (objective) => text[objective.key])).toEqual(objectives);
  });
});

describe("goal tags", () => {
  it("collects kill and spawn mob tags in tree order, each once", () => {
    expect(goalMobTags(BEES)).toEqual(["SW.Mob.Zombie", "SW.Mob.Creeper"]);
  });
  it("collects arena setups, each once", () => {
    expect(goalArenaTags(BEES)).toEqual(["SW.ArenaSetup.Plains.A1"]);
    expect(goalArenaTags(undefined)).toEqual([]);
  });
});
