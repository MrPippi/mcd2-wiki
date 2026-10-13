/**
 * The mobs of each quest arena: ArenaFight → its spawn-wave definition → each wave step's own mob list, or the spawn
 * definition the step names in SpawndefinitionOverride, resolved through DT_SpawnDefinition. A spawn definition's
 * pools (SpawnTable and AdditionalSpawnTables) can name nested definitions; its area conditions add or remove mobs
 * when the quest's area is the condition's area (other conditions, random or game state, are not applied).
 */
import { issue, type Issue } from "./issues";
import { normalizeTag, tagKey } from "./mob-tags";
import type { ArenaRow, SpawnRow, WaveRow } from "./quest-tables";

/** The game's "no override" value. */
const NONE = "none";
const SPAWN_PREFIX = "sw.spawndefinition.";
const MOB_PREFIX = "sw.mob.";
const MAX_DEPTH = 6;

export interface ArenaMobs {
  /** Arena setup tag → the mob tags its waves spawn in that area, each once, in first-seen order. */
  readonly mobsOf: (arenaTag: string, areaTag: string) => readonly string[];
  /** One issue per override tag that names no spawn definition or leads to no mob. */
  readonly issues: Issue[];
}

type WaveStep = NonNullable<NonNullable<WaveRow["SpawnWaveDefinition"]>["Waves"]>[number];
type Slot = NonNullable<NonNullable<SpawnRow["SpawnDefinition"]>["SpawnSlot"]>[string];
type Weighted = NonNullable<NonNullable<Slot["SpawnTable"]>["Tags"]>[number];
type Condition = NonNullable<Slot["Conditions"]>[number];

/** A wave step's override tag, or undefined when it has none (absent or "None"). */
const overrideOf = (step: WaveStep): string | undefined => {
  const tag = step.SpawndefinitionOverride?.TagName;
  return tag === undefined || tagKey(tag) === NONE ? undefined : tag;
};

const adds = (entry: Weighted): boolean => entry.Operation === "Set" && entry.Weight > 0;
const removes = (entry: Weighted): boolean => entry.Operation === "Multiply" && entry.Weight === 0;

/** Whether an area condition holds in this area: the area is the condition's area or lies inside it. */
function conditionHolds(condition: Condition, areaTag: string): boolean {
  const area = tagKey(areaTag);
  const areas = (condition.Condition?.InstanceData ?? []).flatMap((data) => [...(data.AreaTag ? [data.AreaTag] : []), ...(data.AreaTags ?? [])]);
  return areas.some(({ TagName }) => area === tagKey(TagName) || area.startsWith(`${tagKey(TagName)}.`));
}

/** The tags a slot can spawn in this area: its pools, plus what holding area conditions add, minus what they remove. */
function slotTags(slot: Slot, areaTag: string): string[] {
  const pools = [slot.SpawnTable, ...Object.values(slot.AdditionalSpawnTables ?? {})].flatMap((table) => table?.Tags ?? []);
  const holding = (slot.Conditions ?? []).filter((condition) => conditionHolds(condition, areaTag)).flatMap((condition) => condition.DropTable?.Tags ?? []);
  const removed = new Set(holding.filter(removes).map((entry) => tagKey(entry.TypeTag.TagName)));
  return [...pools.filter(adds), ...holding.filter(adds)].map((entry) => entry.TypeTag.TagName).filter((tag) => !removed.has(tagKey(tag)));
}

/** The mob tags a spawn definition leads to in this area, following nested definitions (never in a loop). */
export function resolveSpawn(spawns: ReadonlyMap<string, SpawnRow>, spawnTag: string, areaTag: string): string[] {
  const walk = (tag: string, path: ReadonlySet<string>): string[] => {
    const key = tagKey(tag);
    const row = spawns.get(key);
    if (row === undefined || path.has(key) || path.size >= MAX_DEPTH) return [];
    const next = new Set([...path, key]);
    return Object.values(row.SpawnDefinition?.SpawnSlot ?? {})
      .flatMap((slot) => slotTags(slot, areaTag))
      .flatMap((child) => {
        if (tagKey(child).startsWith(SPAWN_PREFIX)) return walk(child, next);
        return tagKey(child).startsWith(MOB_PREFIX) ? [normalizeTag(child)] : [];
      });
  };
  return [...new Set(walk(spawnTag, new Set()))];
}

const byTag = <T extends { readonly TypeTag?: { readonly TagName: string } }>(rows: readonly T[]): Map<string, T> => {
  const result = new Map<string, T>();
  for (const row of rows) if (row.TypeTag && !result.has(tagKey(row.TypeTag.TagName))) result.set(tagKey(row.TypeTag.TagName), row);
  return result;
};

export function arenaMobIndex(arenas: readonly ArenaRow[], waves: readonly WaveRow[], spawns: readonly SpawnRow[]): ArenaMobs {
  const spawnRows = byTag(spawns);
  const waveRows = byTag(waves);
  const arenaRows = byTag(arenas);
  const stepMobs = (step: WaveStep, areaTag: string): string[] => {
    const override = overrideOf(step);
    return [...(step.Waves ?? []).map((spawn) => spawn.MobType.TagName), ...(override ? resolveSpawn(spawnRows, override, areaTag) : [])];
  };
  // Overrides are checked once each, in no area, so the report does not depend on which quests use them.
  const overrides = [...new Set(waves.flatMap((wave) => (wave.SpawnWaveDefinition?.Waves ?? []).flatMap((step) => overrideOf(step) ?? [])))];
  const unresolved = overrides.filter((tag) => resolveSpawn(spawnRows, tag, "").length === 0);
  return {
    mobsOf: (arenaTag, areaTag) => {
      const wave = arenaRows.get(tagKey(arenaTag))?.ArenaFightsDefinition?.SpawnWaveDefinition?.TagName;
      const steps = wave ? (waveRows.get(tagKey(wave))?.SpawnWaveDefinition?.Waves ?? []) : [];
      return [...new Set(steps.flatMap((step) => stepMobs(step, areaTag)))];
    },
    issues: unresolved.map((tag) => issue("quest-spawn-unresolved", tag)),
  };
}
