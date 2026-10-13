import { describe, expect, it } from "vitest";
import { arenaMobIndex, resolveSpawn } from "../../../scripts/extract/quest-arenas";
import type { ArenaRow, SpawnRow, WaveRow } from "../../../scripts/extract/quest-tables";

const tag = (TagName: string) => ({ TagName });
const weighted = (entries: readonly (string | readonly [string, number, string])[]) => ({
  Tags: entries.map((entry) => (typeof entry === "string" ? { TypeTag: tag(entry), Weight: 1, Operation: "Set" } : { TypeTag: tag(entry[0]), Weight: entry[1], Operation: entry[2] })),
});
const arena = (name: string, wave: string): ArenaRow => ({ TypeTag: tag(name), ArenaFightsDefinition: { SpawnWaveDefinition: tag(wave) } });
const wave = (name: string, steps: { mobs?: string[]; override?: string }[]): WaveRow => ({
  TypeTag: tag(name),
  SpawnWaveDefinition: {
    Waves: steps.map((step) => ({
      ...(step.mobs ? { Waves: step.mobs.map((mob) => ({ MobType: tag(mob) })) } : {}),
      ...(step.override ? { SpawndefinitionOverride: tag(step.override) } : {}),
    })),
  },
});
interface SlotFixture {
  readonly pool: readonly (string | readonly [string, number, string])[];
  readonly extra?: readonly string[];
  readonly conditions?: readonly { readonly areas: readonly string[]; readonly drop: readonly (string | readonly [string, number, string])[]; readonly kind?: string }[];
}
const spawn = (name: string, slot: SlotFixture): SpawnRow => ({
  TypeTag: tag(name),
  SpawnDefinition: {
    SpawnSlot: {
      '(TagName="SW.SpawnSlot.Mob")': {
        SpawnTable: weighted(slot.pool),
        ...(slot.extra ? { AdditionalSpawnTables: { "1": weighted(slot.extra) } } : {}),
        ...(slot.conditions
          ? {
              Conditions: slot.conditions.map((condition) => ({
                Condition: { Condition: condition.kind ?? "SWGC_CheckMultipleAreaTags", InstanceData: [{ AreaTags: condition.areas.map(tag) }] },
                DropTable: weighted(condition.drop),
              })),
            }
          : {}),
      },
    },
  },
});

// Shaped like CA02_B's arena 03 and the game's Illagers / Undead definitions.
const SPAWNS = [
  spawn("SW.SpawnDefinition.Quest.WitchEncounter", { pool: ["SW.Mob.Witch.Type3", "SW.SpawnDefinition.Undead"] }),
  spawn("SW.SpawnDefinition.Undead", {
    pool: ["SW.Mob.Zombie", ["SW.Mob.Husk", 0, "Set"]],
    extra: ["SW.Mob.Spider.Jockey"],
    conditions: [
      { areas: ["SW.Area.Camp.A1"], drop: [["SW.Mob.Spider.Jockey", 0, "Multiply"]] },
      { areas: ["SW.Area.Forest.A1"], drop: ["SW.Mob.CaveSpider"] },
    ],
  }),
  spawn("SW.SpawnDefinition.Loop", { pool: ["SW.SpawnDefinition.Loop", "SW.Mob.Slime"] }),
  spawn("SW.SpawnDefinition.Empty", { pool: [] }),
];
const ARENAS = [arena("SW.ArenaSetup.CA02_B.03", "SW.ArenaWave.Witch"), arena("SW.ArenaSetup.Plain", "SW.ArenaWave.Plain"), arena("SW.ArenaSetup.NoWave", "SW.ArenaWave.Gone")];
const WAVES = [
  wave("SW.ArenaWave.Witch", [{ mobs: ["SW.Mob.Pillager"], override: "SW.SpawnDefinition.Quest.WitchEncounter" }, { override: "None" }]),
  wave("SW.ArenaWave.Plain", [{ mobs: ["SW.Mob.Maw", "SW.Mob.Maw"] }]),
  wave("SW.ArenaWave.Broken", [{ override: "SW.SpawnDefinition.Missing" }, { override: "SW.SpawnDefinition.Empty" }]),
];
const BY_TAG = new Map(SPAWNS.map((row) => [row.TypeTag.TagName.toLowerCase(), row]));

describe("resolveSpawn", () => {
  it("follows nested definitions and both pools, leaving out zero-weight entries", () => {
    expect(resolveSpawn(BY_TAG, "SW.SpawnDefinition.Quest.WitchEncounter", "SW.Area.Plains.A1")).toEqual(["SW.Mob.Witch.Type3", "SW.Mob.Zombie", "SW.Mob.Spider.Jockey"]);
  });
  it("applies an area condition in that area and inside it: adds and removes mobs", () => {
    expect(resolveSpawn(BY_TAG, "SW.SpawnDefinition.Undead", "SW.Area.Camp.A1")).toEqual(["SW.Mob.Zombie"]);
    expect(resolveSpawn(BY_TAG, "SW.SpawnDefinition.Undead", "SW.Area.Forest.A1.SpiderCaves")).toEqual(["SW.Mob.Zombie", "SW.Mob.Spider.Jockey", "SW.Mob.CaveSpider"]);
  });
  it("stops at a loop and at an unknown definition", () => {
    expect(resolveSpawn(BY_TAG, "SW.SpawnDefinition.Loop", "")).toEqual(["SW.Mob.Slime"]);
    expect(resolveSpawn(BY_TAG, "SW.SpawnDefinition.Missing", "")).toEqual([]);
  });
});

describe("arenaMobIndex", () => {
  const index = arenaMobIndex(ARENAS, WAVES, SPAWNS);

  it("follows a wave step's spawn-definition override as well as its own mobs", () => {
    expect(index.mobsOf("sw.arenasetup.ca02_b.03", "SW.Area.Forest.A1")).toEqual([
      "SW.Mob.Pillager", "SW.Mob.Witch.Type3", "SW.Mob.Zombie", "SW.Mob.Spider.Jockey", "SW.Mob.CaveSpider",
    ]);
  });

  it("reads a wave's own mob list, each mob once", () => {
    expect(index.mobsOf("SW.ArenaSetup.Plain", "SW.Area")).toEqual(["SW.Mob.Maw"]);
  });

  it("gives nothing for an unknown arena or a wave that is not there", () => {
    expect(index.mobsOf("SW.ArenaSetup.Nope", "SW.Area")).toEqual([]);
    expect(index.mobsOf("SW.ArenaSetup.NoWave", "SW.Area")).toEqual([]);
  });

  it("reports each override that names no spawn definition or leads to no mob, and treats None as no override", () => {
    expect(index.issues).toEqual([
      { type: "quest-spawn-unresolved", detail: "SW.SpawnDefinition.Missing" },
      { type: "quest-spawn-unresolved", detail: "SW.SpawnDefinition.Empty" },
    ]);
  });
});
