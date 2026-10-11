/** What the Soul Storm fight is made of: the three generator tiers, the storm chests, the chest rarity modifier and the unlock gate. */
import { ExtractError, issue, type Issue } from "./issues";
import { hasPoolTags, slotsOf } from "./loot-slots";
import type { LootRow } from "./loot-tables";
import { normalizeTag, tagKey } from "./mob-tags";
import { GENERATOR_TIERS, type Chest, type Generator, type SoulStormData } from "./soul-storm-schema";
import type { GameBalanceRow, PropRow, RarityChanceRow, SoulStormTables, SpawnRow } from "./soul-storm-tables";

type Tier = (typeof GENERATOR_TIERS)[number];
type KeyValueRow = NonNullable<NonNullable<PropRow["Abilities"]>[number]["CommonKeyValues"]>[number];
type TierWeights = Partial<Record<Tier, number>>;
/** A value read from the tables, with an issue for every fallback or drop on the way. */
interface Found<Value> {
  readonly value: Value;
  readonly issues: Issue[];
}

const MAX_SPAWN_DEPTH = 4;
const PERCENT = 100;
const PROP_PREFIX = "SW.PropActor.SoulStorm.Storminator";
const BASE_TAG = `${PROP_PREFIX}.Base`;
const BARRIER_TAG = "SW.PropActor.SoulStorm.Barrier";
const SPAWN_TAG = "SW.SpawnDefinition.Storminator";
const SHIELD_CALLSIGN = "SW.AbilityCallsign.Soulstorm.SpawnShield";
const FINAL_CALLSIGN = "SW.AbilityCallsign.Soulstorm.StorminatorHealthFinalThreshold";
const FINAL_EVENT = "SW.GameplayEvent.SoulStorm.Health.FinalThreshold";
const HEALTH_MAX = 'AttributeName="HealthMax"';
const CHEST_PREFIX = "SW.LootActor.StorminatorChest";
const RESISTANCES = [
  ["SoulDamageResistanceMultiplier", "resistSoul"],
  ["MeleeDamageResistanceMultiplier", "resistMelee"],
  ["Resistance.KnockbackResistanceMultiplier", "knockbackResistance"],
] as const;
/** Generator chests easy → hard, then reward chests low → high. */
const CHEST_ORDER = [
  ["generator", "easy"], ["generator", "medium"], ["generator", "hard"],
  ["final", "low"], ["final", "medium"], ["final", "high"],
] as const satisfies readonly (readonly [Chest["group"], Chest["tier"]])[];

const sameTag = (left: string, right: string): boolean => tagKey(left) === tagKey(right);
const rowByTag = <Row extends { readonly TypeTag: { readonly TagName: string } }>(rows: readonly Row[], tag: string): Row | undefined =>
  rows.find((row) => sameTag(row.TypeTag.TagName, tag));
const capitalized = (tier: string): string => `${tier[0].toUpperCase()}${tier.slice(1)}`;
const missingValue = (detail: string): Issue => issue("soul-storm-value-missing", detail);

function attribute(row: PropRow | undefined, name: string): number | undefined {
  return row?.AttributeValues?.find((value) => sameTag(value.Attribute.TagName, `SW.Attribute.${name}`))?.Value;
}

function keyValueOf(values: readonly KeyValueRow[] | undefined, name: string): number | undefined {
  const found = values?.find((value) => sameTag(value.TypeTag.TagName, `SW.KeyValue.${name}`));
  return found?.Int ?? found?.Float;
}

const abilityOf = (row: PropRow | undefined, callsign: string) =>
  row?.Abilities?.find((ability) => ability.AbilityCallsign !== undefined && sameTag(ability.AbilityCallsign.TagName, callsign));

function scalingOf(row: PropRow | undefined): number[] | undefined {
  const entry = Object.entries(row?.MultiplayerScalingDefinitions?.TagMap ?? {}).find(([key]) => key.includes(HEALTH_MAX));
  return entry ? [...entry[1].Multipliers] : undefined;
}

/** Health multipliers by player count: the tier's own, else the base row's; none at all is reported and left empty. */
function healthByPlayersOf(tier: Tier, row: PropRow, base: PropRow): Found<number[]> {
  const found = scalingOf(row) ?? scalingOf(base);
  return found === undefined ? { value: [], issues: [missingValue(`${tier}: health by players`)] } : { value: found, issues: [] };
}

/** Shield chance (the game stores an Int percent) and cooldown: the tier's own specialisation, else the base ability. A 0 chance means no shield. */
function shieldOf(tier: Tier, row: PropRow, base: PropRow): Found<Generator["shield"]> {
  const special = row.AbilitySpecialization?.Specializations.find((item) => sameTag(item.AbilityCallsign.TagName, SHIELD_CALLSIGN));
  const own = special?.KeyValueSpecializations?.map((item) => item.KeyValue);
  const common = abilityOf(base, SHIELD_CALLSIGN)?.CommonKeyValues;
  const percent = keyValueOf(own, "ActivationChance") ?? keyValueOf(common, "ActivationChance");
  if (percent === undefined) return { value: null, issues: [missingValue(`${tier}: shield chance`)] };
  if (percent <= 0) return { value: null, issues: [] };
  const cooldown = keyValueOf(own, "CooldownDuration") ?? keyValueOf(common, "CooldownDuration");
  if (cooldown === undefined) return { value: null, issues: [missingValue(`${tier}: shield cooldown`)] };
  return { value: { chance: percent / PERCENT, cooldownSeconds: cooldown }, issues: [] };
}

const slotsOfSpawn = (row: SpawnRow | undefined) => Object.values(row?.SpawnDefinition?.SpawnSlot ?? {});

/** Every tag a spawn row lists, in its spawn tables and its condition drop tables. */
function weightedTags(row: SpawnRow | undefined): { TypeTag: { TagName: string }; Weight: number }[] {
  return slotsOfSpawn(row).flatMap((slot) => [
    ...(slot.SpawnTable?.Tags ?? []),
    ...(slot.Conditions ?? []).flatMap((condition) => condition.DropTable?.Tags ?? []),
  ]);
}

/** The mob tags a spawn definition leads to, following nested definitions (at most 4 deep, never in a loop), in first-seen order. */
export function resolveSpawnMobs(spawns: readonly SpawnRow[], spawnTag: string): string[] {
  const byKey = new Map<string, SpawnRow>();
  for (const row of spawns) if (!byKey.has(tagKey(row.TypeTag.TagName))) byKey.set(tagKey(row.TypeTag.TagName), row);
  const walk = (tag: string, path: ReadonlySet<string>): string[] => {
    const key = tagKey(tag);
    const row = byKey.get(key);
    if (row === undefined || path.size >= MAX_SPAWN_DEPTH || path.has(key)) return [];
    const next = new Set([...path, key]);
    return weightedTags(row).flatMap(({ TypeTag }) => {
      if (tagKey(TypeTag.TagName).startsWith("sw.spawndefinition.")) return walk(TypeTag.TagName, next);
      return tagKey(TypeTag.TagName).startsWith("sw.mob.") ? [normalizeTag(TypeTag.TagName)] : [];
    });
  };
  return [...new Set(walk(spawnTag, new Set()))];
}

/** The generator spawn weights (Easy : Medium : Hard) from the Storminator spawn definition. */
export function spawnWeights(spawns: readonly SpawnRow[]): TierWeights {
  const weighted = weightedTags(rowByTag(spawns, SPAWN_TAG));
  return Object.fromEntries(GENERATOR_TIERS.flatMap((tier) => {
    const found = weighted.find((entry) => sameTag(entry.TypeTag.TagName, `${PROP_PREFIX}.${capitalized(tier)}`));
    return found === undefined ? [] : [[tier, found.Weight]];
  }));
}

export interface GeneratorResult {
  readonly generators: Generator[];
  readonly resistances: SoulStormData["resistances"];
  readonly shieldHealth: number | null;
  readonly issues: Issue[];
}

/** Mob tags → bestiary slugs (deduplicated); a tag the bestiary does not know becomes an issue, never a link. */
function toSlugs(tier: Tier, tags: readonly string[], tagIndex: ReadonlyMap<string, string>): Found<string[]> {
  const slugs = tags.map((tag) => tagIndex.get(tagKey(tag)));
  return {
    value: [...new Set(slugs.filter((slug): slug is string => slug !== undefined))],
    issues: tags.filter((_, index) => slugs[index] === undefined).map((tag) => issue("soul-storm-mob-unlinked", `${tier}: ${tag}`)),
  };
}

interface Picks {
  readonly minPick: number;
  readonly maxPick: number;
}

/** How many mobs one final wave picks: the wave rows' own slot counts, summed; a slot without them counts 1–1 and is reported. */
function picksOf(tier: Tier, waves: readonly string[], spawns: readonly SpawnRow[]): Found<Picks> {
  const perWave = waves.map((wave): Found<Picks> => {
    const row = rowByTag(spawns, wave);
    if (row === undefined) return { value: { minPick: 0, maxPick: 0 }, issues: [issue("soul-storm-row-missing", `${tier}: ${wave}`)] };
    const slots = slotsOfSpawn(row);
    const complete = slots.every((slot) => slot.MinPickTypes !== undefined && slot.MaxPickTypes !== undefined);
    return {
      value: {
        minPick: slots.reduce((sum, slot) => sum + (slot.MinPickTypes ?? 1), 0),
        maxPick: slots.reduce((sum, slot) => sum + (slot.MaxPickTypes ?? 1), 0),
      },
      issues: complete ? [] : [missingValue(`${tier}: pick counts of ${wave}`)],
    };
  });
  return {
    value: { minPick: perWave.reduce((sum, item) => sum + item.value.minPick, 0), maxPick: perWave.reduce((sum, item) => sum + item.value.maxPick, 0) },
    issues: perWave.flatMap((item) => item.issues),
  };
}

function finalOf(tier: Tier, row: PropRow, spawns: readonly SpawnRow[], tagIndex: ReadonlyMap<string, string>): Found<Generator["finalSummon"]> {
  const threshold = row.AttributeThresholds?.Thresholds?.find((item) => sameTag(item.Event.TagName, FINAL_EVENT))?.Value;
  if (threshold === undefined) throw new ExtractError(`Soul Storm 產生器 ${tier} 缺少最終召喚的血量門檻（${FINAL_EVENT}）`);
  const waves = [...new Set((abilityOf(row, FINAL_CALLSIGN)?.InstanceData ?? []).flatMap((data) => (data.WaveArray ?? []).map((wave) => wave.SpawnDefinition.TagName)))];
  const picks = picksOf(tier, waves, spawns);
  const slugs = toSlugs(tier, [...new Set(waves.flatMap((wave) => resolveSpawnMobs(spawns, wave)))], tagIndex);
  const noWave = waves.length === 0 ? [missingValue(`${tier}: ${FINAL_CALLSIGN} WaveArray`)] : [];
  return { value: { healthFraction: threshold, mobs: slugs.value, ...picks.value }, issues: [...noWave, ...picks.issues, ...slugs.issues] };
}

function buildTier(tier: Tier, base: PropRow, tables: SoulStormTables, tagIndex: ReadonlyMap<string, string>, weights: TierWeights): Found<Generator | undefined> {
  const tag = `${PROP_PREFIX}.${capitalized(tier)}`;
  const row = rowByTag(tables.props, tag);
  if (row === undefined) return { value: undefined, issues: [issue("soul-storm-row-missing", tag)] };
  const health = attribute(row, "Health") ?? attribute(base, "Health");
  if (health === undefined) throw new ExtractError(`Soul Storm 產生器 ${tier} 與基礎列都沒有生命值`);
  const scaling = healthByPlayersOf(tier, row, base);
  const shield = shieldOf(tier, row, base);
  const final = finalOf(tier, row, tables.spawns, tagIndex);
  const weight = weights[tier];
  return {
    value: { tier, health, healthByPlayers: scaling.value, spawnWeight: weight ?? null, shield: shield.value, finalSummon: final.value },
    issues: [...(weight === undefined ? [missingValue(`${tier}: spawn weight`)] : []), ...scaling.issues, ...shield.issues, ...final.issues],
  };
}

function resistancesOf(base: PropRow): Found<SoulStormData["resistances"]> {
  const read = RESISTANCES.map(([name, key]) => ({ name, key, value: attribute(base, name) }));
  return {
    value: read.flatMap(({ key, value }) => (value === undefined ? [] : [{ key, value }])),
    issues: read.filter(({ value }) => value === undefined).map(({ name }) => missingValue(`base: ${name}`)),
  };
}

export function buildGenerators(tables: SoulStormTables, tagIndex: ReadonlyMap<string, string>): GeneratorResult {
  const base = rowByTag(tables.props, BASE_TAG);
  if (base === undefined) return { generators: [], resistances: [], shieldHealth: null, issues: [issue("soul-storm-row-missing", BASE_TAG)] };
  const weights = spawnWeights(tables.spawns);
  const tiers = GENERATOR_TIERS.map((tier) => buildTier(tier, base, tables, tagIndex, weights));
  const resistances = resistancesOf(base);
  const barrier = rowByTag(tables.props, BARRIER_TAG);
  const shieldHealth = attribute(barrier, "Health");
  const barrierIssues = barrier === undefined ? [issue("soul-storm-row-missing", BARRIER_TAG)] : shieldHealth === undefined ? [missingValue(`${BARRIER_TAG}: Health`)] : [];
  return {
    generators: tiers.flatMap((item) => item.value ?? []),
    resistances: resistances.value,
    shieldHealth: shieldHealth ?? null,
    issues: [...tiers.flatMap((item) => item.issues), ...resistances.issues, ...barrierIssues],
  };
}

const skipped = (row: LootRow): Issue => issue("soul-storm-row-skipped", `${row.Name}: ${row.TypeTag.TagName}`);

function chestOf(row: LootRow): Found<Chest | undefined> {
  const tag = tagKey(row.TypeTag.TagName);
  const group = tag.includes(".final.") ? "final" : "generator";
  const known = CHEST_ORDER.find(([knownGroup, knownTier]) => knownGroup === group && knownTier === tag.split(".").at(-1));
  const slots = [...slotsOf(row)];
  if (known === undefined || slots.length === 0) return { value: undefined, issues: [skipped(row)] };
  return {
    value: {
      id: row.Name,
      group: known[0],
      tier: known[1],
      slots: slots
        .filter(([, slot]) => slot.NumberOfGuaranteedDrops > 0 || slot.NumberOfRandomRolls > 0)
        .map(([key, slot]) => ({
          slot: key,
          guaranteed: slot.NumberOfGuaranteedDrops,
          rolls: slot.NumberOfRandomRolls,
          chancePerRoll: slot.DropChancePerRoll,
          pool: hasPoolTags(slot) ? "own" : slot.InheritParentDropTable ? "area" : "none",
        })),
    },
    issues: [],
  };
}

const chestRank = (chest: Chest): number => CHEST_ORDER.findIndex(([group, tier]) => group === chest.group && tier === chest.tier);

/** The six storm chests: generator chests easy → hard, then reward chests low → high. A storm chest it cannot place is reported. */
export function buildChests(rows: readonly LootRow[]): { chests: Chest[]; issues: Issue[] } {
  const prefix = `${tagKey(CHEST_PREFIX)}.`;
  const read = rows.filter((row) => tagKey(row.TypeTag.TagName).startsWith(prefix)).map(chestOf);
  const chests = read.flatMap((item) => item.value ?? []);
  return { chests: [...chests].sort((left, right) => chestRank(left) - chestRank(right)), issues: read.flatMap((item) => item.issues) };
}

export function chestRarity(rows: readonly RarityChanceRow[]): { rarity: SoulStormData["chestRarity"]; issues: Issue[] } {
  const tags = rowByTag(rows, CHEST_PREFIX)?.TagList.Tags ?? [];
  const common = tags.find((entry) => sameTag(entry.TypeTag.TagName, "SW.Rarity.Common"))?.Weight;
  const rare = tags.find((entry) => sameTag(entry.TypeTag.TagName, "SW.Rarity.Rare"))?.Weight;
  return common === undefined || rare === undefined
    ? { rarity: null, issues: [missingValue(`chest rarity: ${CHEST_PREFIX}`)] }
    : { rarity: { common, rare }, issues: [] };
}

/** The unlock gate; every rule set saying "None" means no gate, no rule set carrying the field at all is reported. */
export function unlockOf(rows: readonly GameBalanceRow[]): { unlock: SoulStormData["unlock"]; issues: Issue[] } {
  const states = rows.flatMap((row) => row.SoulStormConstants?.SoulStormEligibilityGamestate?.TagName ?? []);
  if (states.length === 0) return { unlock: null, issues: [missingValue("unlock: SoulStormEligibilityGamestate")] };
  const gate = states.find((state) => state !== "None");
  return { unlock: gate === undefined ? null : { gameState: gate }, issues: [] };
}
