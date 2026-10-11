import { describe, expect, it } from "vitest";
import { buildChests, buildGenerators, chestRarity, resolveSpawnMobs, spawnWeights, unlockOf } from "../../../scripts/extract/soul-storm-combat";
import { realSoulStormTables, REAL_BALANCE, soulStormTables } from "../../helpers/soul-storm-tables";

const TAG_INDEX = new Map([
  ["sw.mob.zombie.soulstated", "zombie"], ["sw.mob.vindicator.soulstated", "vindicator"],
  ["sw.mob.witch", "witch"], ["sw.mob.enderman", "enderman"], ["sw.mob.warden", "warden"], ["sw.mob.evoker", "evoker"],
  ["sw.mob.wellspringminiboss", "wellspring-miniboss"], ["sw.mob.driftweaver", "driftweaver"],
  ["sw.mob.monstrosity.copper.storm", "monstrosity-copper"], ["sw.mob.monstrosity.redstone.storm", "monstrosity-red-stone"],
  ["sw.mob.monstrosity.sculk.storm", "monstrosity-sculk"],
]);

describe("resolveSpawnMobs", () => {
  const { spawns } = realSoulStormTables();
  it("follows nested spawn definitions down to mob tags, in order", () => {
    expect(resolveSpawnMobs(spawns, "SW.SpawnDefinition.Storminator.Wave.Type3")).toEqual([
      "SW.Mob.Monstrosity.Copper.Storm", "SW.Mob.Monstrosity.RedStone.Storm", "SW.Mob.Monstrosity.Sculk.Storm",
    ]);
  });
  it("survives a cycle and an unknown tag", () => {
    const loop = soulStormTables({ spawns: [
      { Name: "A", TypeTag: { TagName: "SW.SpawnDefinition.A" }, SpawnDefinition: { SpawnSlot: { s: { SpawnTable: { Tags: [{ TypeTag: { TagName: "SW.SpawnDefinition.A" }, Weight: 1, Operation: "Set" }, { TypeTag: { TagName: "SW.Mob.Zombie" }, Weight: 1, Operation: "Set" }] } } } } },
    ] }).spawns;
    expect(resolveSpawnMobs(loop, "SW.SpawnDefinition.A")).toEqual(["SW.Mob.Zombie"]);
    expect(resolveSpawnMobs(loop, "SW.SpawnDefinition.Missing")).toEqual([]);
  });
});

describe("spawnWeights", () => {
  it("reads the 2:2:1 generator weights", () => {
    expect(spawnWeights(realSoulStormTables().spawns)).toEqual({ easy: 2, medium: 2, hard: 1 });
  });
});

describe("buildGenerators", () => {
  const result = buildGenerators(realSoulStormTables(), TAG_INDEX);
  const byTier = Object.fromEntries(result.generators.map((generator) => [generator.tier, generator]));

  it("lists the three tiers in order", () => {
    expect(result.generators.map((generator) => generator.tier)).toEqual(["easy", "medium", "hard"]);
  });
  it("gives Easy the base row's 800 health and the others their own", () => {
    expect(result.generators.map((generator) => generator.health)).toEqual([800, 1000, 1200]);
    expect(byTier.easy.healthByPlayers).toEqual([1, 1.5, 2, 2.5]);
  });
  it("has no shield generator on Easy and the specialised chance on the others", () => {
    expect(byTier.easy.shield).toBeNull();
    expect(byTier.medium.shield).toEqual({ chance: 0.16, cooldownSeconds: 60 });
    expect(byTier.hard.shield).toEqual({ chance: 0.4, cooldownSeconds: 45 });
  });
  it("names what each tier summons at its final threshold", () => {
    expect(byTier.easy.finalSummon).toEqual({ healthFraction: 0.2, mobs: ["zombie", "vindicator"] });
    expect(byTier.medium.finalSummon).toEqual({ healthFraction: 0.4, mobs: ["witch", "enderman", "warden", "evoker", "wellspring-miniboss", "driftweaver"] });
    expect(byTier.hard.finalSummon).toEqual({ healthFraction: 0.4, mobs: ["monstrosity-copper", "monstrosity-red-stone", "monstrosity-sculk"] });
  });
  it("carries the weights, the base resistances and the shield generator's health", () => {
    expect(result.generators.map((generator) => generator.spawnWeight)).toEqual([2, 2, 1]);
    expect(result.resistances).toEqual([{ key: "resistSoul", value: 0.5 }, { key: "resistMelee", value: 0.8 }, { key: "knockbackResistance", value: 0 }]);
    expect(result.shieldHealth).toBe(55);
    expect(result.issues).toEqual([]);
  });
  it("reports a summoned mob the bestiary does not know, and leaves it out", () => {
    const partial = new Map([...TAG_INDEX].filter(([key]) => key !== "sw.mob.warden"));
    const medium = buildGenerators(realSoulStormTables(), partial);
    expect(medium.generators[1].finalSummon.mobs).not.toContain("warden");
    expect(medium.issues).toEqual([{ type: "soul-storm-mob-unlinked", detail: "medium: SW.Mob.Warden" }]);
  });
  it("returns no generators when the base row is missing", () => {
    const none = buildGenerators(soulStormTables(), TAG_INDEX);
    expect(none.generators).toEqual([]);
    expect(none.shieldHealth).toBeNull();
  });
});

describe("buildChests", () => {
  const chests = buildChests(realSoulStormTables().lootActor);
  it("keeps the six storm chests in generator then final order, and nothing else", () => {
    expect(chests.map((chest) => `${chest.group}:${chest.tier}`)).toEqual([
      "generator:easy", "generator:medium", "generator:hard", "final:low", "final:medium", "final:high",
    ]);
  });
  it("describes each slot as guaranteed plus rolls, with no item list for gear", () => {
    const high = chests[5];
    expect(high.id).toBe("SoulStormRewardChestHigh");
    expect(high.slots).toEqual([
      { slot: "item", guaranteed: 4, rolls: 0, chancePerRoll: 1, pool: "none" },
      { slot: "emeralds", guaranteed: 10, rolls: 15, chancePerRoll: 0.3, pool: "own" },
      { slot: "springStone", guaranteed: 4, rolls: 3, chancePerRoll: 0.33, pool: "own" },
    ]);
    expect(chests[0].slots.find((s) => s.slot === "springStone")).toEqual({ slot: "springStone", guaranteed: 1, rolls: 2, chancePerRoll: 0.33, pool: "own" });
  });
});

describe("chestRarity and unlockOf", () => {
  it("reads the storm chest rarity multipliers", () => {
    expect(chestRarity(realSoulStormTables().rarityChance)).toEqual({ common: 0, rare: 0.01 });
    expect(chestRarity([])).toBeNull();
  });
  it("finds the main-quest gate and nothing when every rule set says None", () => {
    expect(unlockOf(realSoulStormTables().gameBalance)).toEqual({ gameState: "SW.GameState.MainQuestComplete" });
    expect(unlockOf(soulStormTables({ gameBalance: [REAL_BALANCE()[0]] }).gameBalance)).toBeNull();
  });
});
