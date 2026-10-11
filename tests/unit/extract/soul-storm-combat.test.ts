import { describe, expect, it } from "vitest";
import { buildChests, buildGenerators, chestRarity, resolveSpawnMobs, spawnWeights, unlockOf } from "../../../scripts/extract/soul-storm-combat";
import { lootRow, slot } from "../../helpers/mob-tables";
import {
  BASE_TAG, baseGenerator, realSoulStormTables, REAL_BALANCE, REAL_CHESTS, REAL_GENERATORS, REAL_SPAWNS, soulStormTables, spawnRow, tierGenerator,
} from "../../helpers/soul-storm-tables";

const SHIELD = "SW.AbilityCallsign.Soulstorm.SpawnShield";
const chance = (percent: number) => ({ TypeTag: { TagName: "SW.KeyValue.ActivationChance" }, Type: "Int", Int: percent });
const realWith = (partial: Parameters<typeof soulStormTables>[0]) => soulStormTables({
  props: REAL_GENERATORS(), spawns: REAL_SPAWNS(), lootActor: REAL_CHESTS(), ...partial,
});

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
    expect(byTier.easy.finalSummon).toEqual({ healthFraction: 0.2, mobs: ["zombie", "vindicator"], minPick: 1, maxPick: 2 });
    expect(byTier.medium.finalSummon).toEqual({
      healthFraction: 0.4, mobs: ["witch", "enderman", "warden", "evoker", "wellspring-miniboss", "driftweaver"], minPick: 1, maxPick: 1,
    });
    expect(byTier.hard.finalSummon).toEqual({ healthFraction: 0.4, mobs: ["monstrosity-copper", "monstrosity-red-stone", "monstrosity-sculk"], minPick: 1, maxPick: 1 });
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
  it("returns no generators when the base row is missing, and says so", () => {
    const none = buildGenerators(soulStormTables(), TAG_INDEX);
    expect(none.generators).toEqual([]);
    expect(none.shieldHealth).toBeNull();
    expect(none.issues).toEqual([{ type: "soul-storm-row-missing", detail: BASE_TAG }]);
  });
});

describe("buildGenerators never invents a value", () => {
  const build = (partial: Parameters<typeof soulStormTables>[0]) => buildGenerators(realWith(partial), TAG_INDEX);

  it("reports a missing tier row and leaves the tier out", () => {
    const result = build({ props: REAL_GENERATORS().filter((row) => row.Name !== "Storminator_Medium") });
    expect(result.generators.map((generator) => generator.tier)).toEqual(["easy", "hard"]);
    expect(result.issues).toEqual([{ type: "soul-storm-row-missing", detail: "SW.PropActor.SoulStorm.Storminator.Medium" }]);
  });
  it("shows no spawn weight when the spawn definition has none", () => {
    const result = build({ spawns: REAL_SPAWNS().filter((row) => row.Name !== "StorminatorEasy") });
    expect(result.generators.map((generator) => generator.spawnWeight)).toEqual([null, null, null]);
    expect(result.issues).toEqual(["easy", "medium", "hard"].map((tier) => ({ type: "soul-storm-value-missing", detail: `${tier}: spawn weight` })));
  });
  it("leaves out the player multipliers when no row has them", () => {
    const props = REAL_GENERATORS().map((row) => ({ ...row, MultiplayerScalingDefinitions: undefined }));
    const result = build({ props });
    expect(result.generators.map((generator) => generator.healthByPlayers)).toEqual([[], [], []]);
    expect(result.issues).toEqual(["easy", "medium", "hard"].map((tier) => ({ type: "soul-storm-value-missing", detail: `${tier}: health by players` })));
  });
  it("drops a shield without a cooldown and one without a chance", () => {
    const base = { ...baseGenerator(), Abilities: [] };
    const hard = tierGenerator("Hard", { health: 1200, finalThreshold: 0.4, finalWave: "SW.SpawnDefinition.Storminator.Wave.Type3" });
    const hardNoCooldown = { ...hard, AbilitySpecialization: { Specializations: [{ AbilityCallsign: { TagName: SHIELD }, KeyValueSpecializations: [{ KeyValue: chance(40) }] }] } };
    const props = [base, ...REAL_GENERATORS().filter((row) => row.Name !== "Storminator" && row.Name !== "Storminator_Hard"), hardNoCooldown];
    const result = build({ props });
    expect(result.generators.map((generator) => generator.shield)).toEqual([null, { chance: 0.16, cooldownSeconds: 60 }, null]);
    expect(result.issues).toEqual([
      { type: "soul-storm-value-missing", detail: "easy: shield chance" },
      { type: "soul-storm-value-missing", detail: "hard: shield cooldown" },
    ]);
  });
  it("counts one summon and says so when the wave has no pick counts", () => {
    const spawns = REAL_SPAWNS().map((row) => (row.Name === "StorminatorWaveSoulstated"
      ? spawnRow(row.Name, row.TypeTag.TagName, [["SW.Mob.Zombie.SoulStated", 1]], null)
      : row));
    const result = build({ spawns });
    expect(result.generators[0].finalSummon).toMatchObject({ minPick: 1, maxPick: 1 });
    expect(result.issues).toEqual([{ type: "soul-storm-value-missing", detail: "easy: pick counts of SW.SpawnDefinition.Storminator.Wave.SoulstatedUndead" }]);
  });
  it("summons nothing from a wave row the table lacks, and says so", () => {
    const result = build({ spawns: REAL_SPAWNS().filter((row) => row.Name !== "Type2") });
    expect(result.generators[1].finalSummon).toEqual({ healthFraction: 0.4, mobs: [], minPick: 0, maxPick: 0 });
    expect(result.issues).toEqual([{ type: "soul-storm-row-missing", detail: "medium: SW.SpawnDefinition.Storminator.Wave.Type2" }]);
  });
  it("reports a missing shield generator row and a missing resistance", () => {
    const base = baseGenerator();
    const props = [
      { ...base, AttributeValues: base.AttributeValues.filter((value) => !value.Attribute.TagName.endsWith("MeleeDamageResistanceMultiplier")) },
      ...REAL_GENERATORS().filter((row) => row.Name !== "Storminator" && row.Name !== "Shieldinator"),
    ];
    const result = build({ props });
    expect(result.shieldHealth).toBeNull();
    expect(result.resistances.map((stat) => stat.key)).toEqual(["resistSoul", "knockbackResistance"]);
    expect(result.issues).toEqual([
      { type: "soul-storm-value-missing", detail: "base: MeleeDamageResistanceMultiplier" },
      { type: "soul-storm-row-missing", detail: "SW.PropActor.SoulStorm.Barrier" },
    ]);
  });
});

describe("buildChests", () => {
  const { chests, issues } = buildChests(realSoulStormTables().lootActor);
  it("reports nothing for the real chests", () => {
    expect(issues).toEqual([]);
  });
  it("reports a storm chest it cannot place and one with no slots, and leaves them out", () => {
    const extra = [
      lootRow("Mythic", "SW.LootActor.StorminatorChest.Mythic", [slot("Item", 1, 0, 1, false)]),
      lootRow("Empty", "SW.LootActor.StorminatorChest.Final.Low", []),
    ];
    const result = buildChests(soulStormTables({ lootActor: extra }).lootActor);
    expect(result.chests).toEqual([]);
    expect(result.issues).toEqual([
      { type: "soul-storm-row-skipped", detail: "Mythic: SW.LootActor.StorminatorChest.Mythic" },
      { type: "soul-storm-row-skipped", detail: "Empty: SW.LootActor.StorminatorChest.Final.Low" },
    ]);
  });
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
    expect(chestRarity(realSoulStormTables().rarityChance)).toEqual({ rarity: { common: 0, rare: 0.01 }, issues: [] });
    expect(chestRarity([])).toEqual({ rarity: null, issues: [{ type: "soul-storm-value-missing", detail: "chest rarity: SW.LootActor.StorminatorChest" }] });
  });
  it("finds the main-quest gate and nothing when every rule set says None", () => {
    expect(unlockOf(realSoulStormTables().gameBalance)).toEqual({ unlock: { gameState: "SW.GameState.MainQuestComplete" }, issues: [] });
    expect(unlockOf(soulStormTables({ gameBalance: [REAL_BALANCE()[0]] }).gameBalance)).toEqual({ unlock: null, issues: [] });
  });
  it("says so when no rule set carries the unlock state", () => {
    expect(unlockOf([])).toEqual({ unlock: null, issues: [{ type: "soul-storm-value-missing", detail: "unlock: SoulStormEligibilityGamestate" }] });
  });
});
