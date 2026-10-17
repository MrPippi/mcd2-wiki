/**
 * Threat levels 1..20 and the three difficulties. Every curve is found through a reference in a DataTable, never by a
 * fixed curve name: DT_GameBalanceDefinition (SecondPass row) names the damage, rarity and effect-tier curves,
 * DT_WorldActorDefinition the mob spawn settings table, and DT_DifficultyDefinition each difficulty's multipliers.
 */
import { cleanCurveValue, curveNotes, evaluateCurve, findCurve, parseCurveRef, sampleThreat, THREAT_LEVELS, type CurveTables } from "./curve-tables";
import { RARITIES, DIFFICULTIES, type Difficulty, type DifficultyData, type Rarity, type ThreatRow } from "./guides-schema";
import { rarityOfTag } from "./guides-enchanting";
import type { DifficultyRow, GameBalanceRow, GuideTables } from "./guides-tables";
import { rowText, type Locales } from "./guides-texts";
import { mapKeyTag } from "./guides-vendors";
import { issue, type Issue } from "./issues";

/** Which of the game's two balance rows carries the curves; "Active" lists none (which one the game runs is not in the data). */
const BALANCE_ROW = "SecondPass";
const RARITY_TAG_PREFIX = "SW.Rarity.";
const MOB_SETTINGS_ASSET = "SW.Asset.MobSpawnSettings";
/** The rows of the mob spawn settings table; the table itself is named by DT_WorldActorDefinition. */
const MOB_RANGES = {
  mobVariantChance: ["VariantSpawnChancePercentMin", "VariantSpawnChancePercentMax"],
  soulStatedCost: ["SoulStatedSpawnCostMin", "SoulStatedSpawnCostMax"],
  minibossCost: ["MinibossSpawnCostMin", "MinibossSpawnCostMax"],
} as const;
const NAME = "SW.TextEntry.Name";
const DESCRIPTION = "SW.TextEntry.Description";
const RECEIVED = "SW.TextEntry.Description.DifficultyDamageReceived";
const DEALT = "SW.TextEntry.Description.DifficultyDamageDealt";

type CurveRefInput = { readonly CurveTable: string; readonly RowName: string };

interface Sampled {
  readonly values?: readonly number[];
  readonly issues: Issue[];
}

/** The curve a reference names at threat 1..20; undefined values, with an issue, when the reference or its curve is missing. */
function sample(curves: CurveTables, ref: CurveRefInput | undefined, label: string): Sampled {
  const parsed = ref ? parseCurveRef(ref) : undefined;
  const curve = parsed ? findCurve(curves, parsed) : undefined;
  if (parsed && curve) return { values: sampleThreat(curve), issues: curveNotes(parsed, curve) };
  return { issues: [issue("guides-value-missing", parsed ? `${label}: ${parsed.table}/${parsed.row} not in the curve tables` : `${label}: no curve reference`)] };
}

/** The parts' values per level when every part has them; otherwise none (one missing part leaves the whole group out). */
function together<K extends string>(parts: Readonly<Record<K, Sampled>>): { levels?: Readonly<Record<K, readonly number[]>>; issues: Issue[] } {
  const entries = Object.entries<Sampled>(parts);
  const issues = entries.flatMap(([, part]) => part.issues);
  const complete = entries.every(([, part]) => part.values !== undefined);
  return { issues, levels: complete ? (Object.fromEntries(entries.map(([key, part]) => [key, part.values])) as Record<K, readonly number[]>) : undefined };
}

const pick = <K extends string>(levels: Readonly<Record<K, readonly number[]>>, index: number): Record<K, number> =>
  Object.fromEntries(Object.entries<readonly number[]>(levels).map(([key, values]) => [key, values[index]])) as Record<K, number>;

const optional = <K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> =>
  (value === undefined ? {} : { [key]: value }) as Partial<Record<K, V>>;

const refOf = (map: Readonly<Record<string, CurveRefInput>> | undefined, matches: (tag: string) => boolean): CurveRefInput | undefined =>
  Object.entries(map ?? {}).find(([key]) => matches(mapKeyTag(key)))?.[1];

function rarityCurves(curves: CurveTables, row: GameBalanceRow) {
  const map = row.ItemCreatorConstants?.RarityChanceMap;
  return together(Object.fromEntries(RARITIES.map((rarity) => [rarity, sample(curves, refOf(map, (tag) => rarityOfTag(tag) === rarity), `${row.Name} rarity chance ${RARITY_TAG_PREFIX}${rarity[0].toUpperCase()}${rarity.slice(1)}`)])) as Record<Rarity, Sampled>);
}

function tierCurves(curves: CurveTables, row: GameBalanceRow) {
  const map = row.ItemCreatorConstants?.EffectChanceScalingCurves;
  const tier = (number: number): Sampled => sample(curves, refOf(map, (tag) => tag === `SW.Effect.Tier.${number}`), `${row.Name} SW.Effect.Tier.${number}`);
  return together({ first: tier(1), second: tier(2), third: tier(3) });
}

const tiersAt = (levels: Readonly<Record<"first" | "second" | "third", readonly number[]>> | undefined, index: number): [number, number, number] | undefined => {
  if (!levels) return undefined;
  const { first, second, third } = pick(levels, index);
  return [first, second, third];
};

function damageCurves(curves: CurveTables, row: GameBalanceRow) {
  const settings = row.GameBalanceDefinition?.GlobalDifficultyScalingSettings;
  return {
    attack: sample(curves, settings?.OutgoingDamageModifierCurve, `${row.Name} OutgoingDamageModifierCurve`),
    resistance: sample(curves, settings?.IncomingDamageModifierCurve, `${row.Name} IncomingDamageModifierCurve`),
  };
}

/** The min and max rows of the mob spawn settings, as {min, max} per level. */
function mobRanges(curves: CurveTables, table: string) {
  return Object.entries(MOB_RANGES).map(([key, [min, max]]) => {
    const row = (name: string): Sampled => sample(curves, { CurveTable: table, RowName: name }, `${MOB_SETTINGS_ASSET} ${name}`);
    return { key, ...together({ min: row(min), max: row(max) }) };
  });
}

/** The mob spawn settings table's object path; undefined (with an issue) when DT_WorldActorDefinition lists none. */
function mobSettingsTable(tables: GuideTables): { table?: string; issues: Issue[] } {
  const asset = tables.worldActor.flatMap((row) => row.AdditionalAssets?.Assets ?? []).find((candidate) => candidate.Name === MOB_SETTINGS_ASSET);
  return asset ? { table: asset.Object, issues: [] } : { issues: [issue("guides-value-missing", `DT_WorldActorDefinition: ${MOB_SETTINGS_ASSET}`)] };
}

/** One row per threat level; a group of parts is left out when any curve of it is missing, and reported. */
export function buildThreat(tables: GuideTables, curves: CurveTables): { threat: ThreatRow[]; issues: Issue[] } {
  // Without any curve table the loader has already reported it; a table of recommended levels alone says nothing.
  if (Object.keys(curves).length === 0) return { threat: [], issues: [] };
  const balance = tables.gameBalance.find((row) => row.Name === BALANCE_ROW);
  if (!balance) return { threat: [], issues: [issue("guides-value-missing", `DT_GameBalanceDefinition: ${BALANCE_ROW}`)] };
  const damage = damageCurves(curves, balance);
  const rarity = rarityCurves(curves, balance);
  const tiers = tierCurves(curves, balance);
  const mobTable = mobSettingsTable(tables);
  const mobs = mobTable.table ? mobRanges(curves, mobTable.table) : [];
  const perThreat = balance.GameBalanceDefinition?.CharacterLevelsPerThreat;
  const threat = THREAT_LEVELS.map((level, index): ThreatRow => ({
    level,
    ...optional("recommendedLevel", perThreat === undefined ? undefined : Math.max(level - 1, 0) * perThreat),
    ...optional("attackPower", damage.attack.values?.[index]),
    ...optional("damageResistance", damage.resistance.values?.[index]),
    ...optional("effectTiers", tiersAt(tiers.levels, index)),
    ...optional("rarity", rarity.levels && pick(rarity.levels, index)),
    ...Object.fromEntries(mobs.flatMap(({ key, levels }) => (levels ? [[key, pick(levels, index)]] : []))),
  }));
  return {
    threat,
    issues: [...damage.attack.issues, ...damage.resistance.issues, ...tiers.issues, ...rarity.issues, ...mobTable.issues, ...mobs.flatMap(({ issues }) => issues)],
  };
}

const difficultyIdOf = (row: DifficultyRow): Difficulty | undefined => DIFFICULTIES.find((id) => id === row.Name.toLowerCase());

/** A difficulty's multiplier (the curve at its first key); Normal's missing row reads as 1 and is flagged as assumed. */
function multiplier(curves: CurveTables, ref: CurveRefInput, row: DifficultyRow, id: Difficulty): { value?: number; assumed: boolean; issues: Issue[] } {
  const parsed = parseCurveRef(ref);
  const curve = parsed ? findCurve(curves, parsed) : undefined;
  if (parsed && curve) return { value: cleanCurveValue(evaluateCurve(curve, 1)), assumed: false, issues: curveNotes(parsed, curve) };
  const where = `DT_DifficultyDefinition ${row.Name}: ${parsed ? `${parsed.table}/${parsed.row}` : "no curve reference"}`;
  return id === "normal"
    ? { value: 1, assumed: true, issues: [issue("guides-value-missing", `${where} (assumed 1)`)] }
    : { assumed: false, issues: [issue("guides-value-missing", where)] };
}

function difficultyOf(row: DifficultyRow, id: Difficulty, curves: CurveTables, locales: Locales): { difficulty?: DifficultyData; issues: Issue[] } {
  const definition = row.DifficultyDefinition;
  const incoming = multiplier(curves, definition.DifficultyCurveIncomingDamage, row, id);
  const outgoing = multiplier(curves, definition.DifficultyCurveOutgoingDamage, row, id);
  const name = rowText(locales, row.TypeTextData, NAME);
  const description = rowText(locales, row.TypeTextData, DESCRIPTION);
  const received = rowText(locales, row.TypeTextData, RECEIVED);
  const dealt = rowText(locales, row.TypeTextData, DEALT);
  const issues = [incoming, outgoing, name, description, received, dealt].flatMap((part) => part.issues);
  if (incoming.value === undefined || outgoing.value === undefined || !name.text || !description.text) return { issues };
  return {
    difficulty: {
      id,
      scalar: definition.DifficultyScalar,
      name: name.text,
      description: description.text,
      ...optional("received", received.text),
      ...optional("dealt", dealt.text),
      incoming: incoming.value,
      outgoing: outgoing.value,
      ...(incoming.assumed || outgoing.assumed ? { assumed: true } : {}),
    },
    issues,
  };
}

/** Whether the rarity-chance row of this difficulty (same TypeTag) multiplies both Special and Unique by 0. */
function zeroesRareDrops(tables: GuideTables, row: DifficultyRow): boolean | undefined {
  const chance = tables.rarityChance.find((candidate) => candidate.TypeTag.TagName === row.TypeTag.TagName);
  if (!chance) return undefined;
  const tags = chance.TagList.Tags ?? [];
  const zeroed = (rarity: Rarity): boolean => tags.some((tag) => rarityOfTag(tag.TypeTag.TagName) === rarity && tag.Operation.toLowerCase() === "multiply" && tag.Weight === 0);
  return zeroed("special") && zeroed("unique");
}

/** Low, Normal and High in that order, each with the game's texts, multipliers and whether it zeroes the rare drops. */
export function buildDifficulty(tables: GuideTables, curves: CurveTables, locales: Locales): { difficulty: DifficultyData[]; issues: Issue[] } {
  const built = tables.difficulty.flatMap((row) => {
    const id = difficultyIdOf(row);
    return id ? [{ id, ...difficultyOf(row, id, curves, locales), noRareDrops: zeroesRareDrops(tables, row) }] : [];
  });
  const ordered = DIFFICULTIES.flatMap((id) => built.filter((one) => one.id === id));
  return {
    difficulty: ordered.flatMap(({ difficulty, noRareDrops }) => (difficulty ? [{ ...difficulty, ...optional("noRareDrops", noRareDrops) }] : [])),
    issues: built.flatMap(({ issues }) => issues),
  };
}
