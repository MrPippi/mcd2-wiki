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

/** Shield chance (the game stores an Int percent) and cooldown: the tier's own specialisation, else the base ability. A 0 chance means no shield. */
function shieldOf(row: PropRow, base: PropRow): Generator["shield"] {
  const special = row.AbilitySpecialization?.Specializations.find((item) => sameTag(item.AbilityCallsign.TagName, SHIELD_CALLSIGN));
  const own = special?.KeyValueSpecializations?.map((item) => item.KeyValue);
  const common = abilityOf(base, SHIELD_CALLSIGN)?.CommonKeyValues;
  const percent = keyValueOf(own, "ActivationChance") ?? keyValueOf(common, "ActivationChance") ?? 0;
  if (percent <= 0) return null;
  return { chance: percent / PERCENT, cooldownSeconds: keyValueOf(own, "CooldownDuration") ?? keyValueOf(common, "CooldownDuration") ?? 0 };
}

/** Every tag a spawn row lists, in its spawn tables and its condition drop tables. */
function weightedTags(row: SpawnRow | undefined): { TypeTag: { TagName: string }; Weight: number }[] {
  return Object.values(row?.SpawnDefinition?.SpawnSlot ?? {}).flatMap((slot) => [
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
function toSlugs(tier: Tier, tags: readonly string[], tagIndex: ReadonlyMap<string, string>): { slugs: string[]; issues: Issue[] } {
  const slugs = tags.map((tag) => tagIndex.get(tagKey(tag)));
  return {
    slugs: [...new Set(slugs.filter((slug): slug is string => slug !== undefined))],
    issues: tags.filter((_, index) => slugs[index] === undefined).map((tag) => issue("soul-storm-mob-unlinked", `${tier}: ${tag}`)),
  };
}

function finalOf(tier: Tier, row: PropRow, spawns: readonly SpawnRow[], tagIndex: ReadonlyMap<string, string>): { summon: Generator["finalSummon"]; issues: Issue[] } {
  const threshold = row.AttributeThresholds?.Thresholds?.find((item) => sameTag(item.Event.TagName, FINAL_EVENT))?.Value;
  if (threshold === undefined) throw new ExtractError(`Soul Storm 產生器 ${tier} 缺少最終召喚的血量門檻（${FINAL_EVENT}）`);
  const waves = (abilityOf(row, FINAL_CALLSIGN)?.InstanceData ?? []).flatMap((data) => (data.WaveArray ?? []).map((wave) => wave.SpawnDefinition.TagName));
  const { slugs, issues } = toSlugs(tier, [...new Set(waves.flatMap((wave) => resolveSpawnMobs(spawns, wave)))], tagIndex);
  return { summon: { healthFraction: threshold, mobs: slugs }, issues };
}

function buildTier(tier: Tier, base: PropRow, tables: SoulStormTables, tagIndex: ReadonlyMap<string, string>, weights: TierWeights): { generator: Generator; issues: Issue[] } | undefined {
  const row = rowByTag(tables.props, `${PROP_PREFIX}.${capitalized(tier)}`);
  if (row === undefined) return undefined;
  const health = attribute(row, "Health") ?? attribute(base, "Health");
  if (health === undefined) throw new ExtractError(`Soul Storm 產生器 ${tier} 與基礎列都沒有生命值`);
  const final = finalOf(tier, row, tables.spawns, tagIndex);
  return {
    generator: {
      tier,
      health,
      healthByPlayers: scalingOf(row) ?? scalingOf(base) ?? [1],
      spawnWeight: weights[tier] ?? 0,
      shield: shieldOf(row, base),
      finalSummon: final.summon,
    },
    issues: final.issues,
  };
}

export function buildGenerators(tables: SoulStormTables, tagIndex: ReadonlyMap<string, string>): GeneratorResult {
  const base = rowByTag(tables.props, BASE_TAG);
  if (base === undefined) return { generators: [], resistances: [], shieldHealth: null, issues: [] };
  const weights = spawnWeights(tables.spawns);
  const tiers = GENERATOR_TIERS.flatMap((tier) => buildTier(tier, base, tables, tagIndex, weights) ?? []);
  return {
    generators: tiers.map((item) => item.generator),
    resistances: RESISTANCES.flatMap(([name, key]) => {
      const value = attribute(base, name);
      return value === undefined ? [] : [{ key, value }];
    }),
    shieldHealth: attribute(rowByTag(tables.props, BARRIER_TAG), "Health") ?? null,
    issues: tiers.flatMap((item) => item.issues),
  };
}

function chestOf(row: LootRow): Chest | undefined {
  const tag = tagKey(row.TypeTag.TagName);
  const group = tag.includes(".final.") ? "final" : "generator";
  const known = CHEST_ORDER.find(([knownGroup, knownTier]) => knownGroup === group && knownTier === tag.split(".").at(-1));
  const slots = [...slotsOf(row)];
  if (known === undefined || slots.length === 0) return undefined;
  return {
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
  };
}

const chestRank = (chest: Chest): number => CHEST_ORDER.findIndex(([group, tier]) => group === chest.group && tier === chest.tier);

/** The six storm chests: generator chests easy → hard, then reward chests low → high. */
export function buildChests(rows: readonly LootRow[]): Chest[] {
  const prefix = `${tagKey(CHEST_PREFIX)}.`;
  const chests = rows.filter((row) => tagKey(row.TypeTag.TagName).startsWith(prefix)).flatMap((row) => chestOf(row) ?? []);
  return [...chests].sort((left, right) => chestRank(left) - chestRank(right));
}

export function chestRarity(rows: readonly RarityChanceRow[]): SoulStormData["chestRarity"] {
  const tags = rowByTag(rows, CHEST_PREFIX)?.TagList.Tags ?? [];
  const common = tags.find((entry) => sameTag(entry.TypeTag.TagName, "SW.Rarity.Common"))?.Weight;
  const rare = tags.find((entry) => sameTag(entry.TypeTag.TagName, "SW.Rarity.Rare"))?.Weight;
  return common === undefined || rare === undefined ? null : { common, rare };
}

export function unlockOf(rows: readonly GameBalanceRow[]): SoulStormData["unlock"] {
  const states = rows.flatMap((row) => row.SoulStormConstants?.SoulStormEligibilityGamestate?.TagName ?? []);
  const gate = states.find((state) => state !== "None");
  return gate === undefined ? null : { gameState: gate };
}
