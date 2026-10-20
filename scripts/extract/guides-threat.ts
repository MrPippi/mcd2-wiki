/**
 * Threat levels and the three difficulties. Every curve is found through a reference in a DataTable, never by a fixed
 * curve name: DT_GameBalanceDefinition (SecondPass row) names the damage, rarity and effect-tier curves,
 * DT_WorldActorDefinition the mob spawn settings table, and DT_DifficultyDefinition each difficulty's multipliers.
 * The threat levels shown are the whole levels the curves have keys for (1..20 in the game).
 */
import { localizedFrom } from "../../shared/lang";
import { cleanCurveValue, curveNotes, findCurve, levelsOf, parseCurveRef, sampleThreat, type Curve, type CurveTables } from "./curve-tables";
import { RARITIES, DIFFICULTIES, type Difficulty, type DifficultyData, type Rarity, type ThreatRow } from "../../shared/guides-schema";
import { rarityOfTag } from "./guides-enchanting";
import type { DifficultyRow, GameBalanceRow, GuideTables } from "./guides-tables";
import { rowText, type Locales } from "./guides-texts";
import { mapKeyTag } from "./guides-vendors";
import { issue, type Issue } from "./issues";
import { escapeHtml } from "../../shared/render-markup";

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

interface Resolved {
  readonly curve?: Curve;
  readonly issues: Issue[];
}

/** The curve a reference names; no curve, with an issue, when the reference or its curve is missing. */
function resolve(curves: CurveTables, ref: CurveRefInput | undefined, label: string): Resolved {
  const parsed = ref ? parseCurveRef(ref) : undefined;
  const curve = parsed ? findCurve(curves, parsed) : undefined;
  if (parsed && curve) return { curve, issues: curveNotes(parsed, curve) };
  return { issues: [issue("guides-value-missing", parsed ? `${label}: ${parsed.table}/${parsed.row} not in the curve tables` : `${label}: no curve reference`)] };
}

/** The parts' curves when every part has one; otherwise none (one missing part leaves the whole group out). */
function together<K extends string>(parts: Readonly<Record<K, Resolved>>): { curves?: Readonly<Record<K, Curve>>; issues: Issue[] } {
  const entries = Object.entries<Resolved>(parts);
  const issues = entries.flatMap(([, part]) => part.issues);
  const complete = entries.every(([, part]) => part.curve !== undefined);
  return { issues, curves: complete ? (Object.fromEntries(entries.map(([key, part]) => [key, part.curve])) as Record<K, Curve>) : undefined };
}

const optional = <K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> =>
  (value === undefined ? {} : { [key]: value }) as Partial<Record<K, V>>;

const refOf = (map: Readonly<Record<string, CurveRefInput>> | undefined, matches: (tag: string) => boolean): CurveRefInput | undefined =>
  Object.entries(map ?? {}).find(([key]) => matches(mapKeyTag(key)))?.[1];

function rarityCurves(curves: CurveTables, row: GameBalanceRow) {
  const map = row.ItemCreatorConstants?.RarityChanceMap;
  return together(Object.fromEntries(RARITIES.map((rarity) => [rarity, resolve(curves, refOf(map, (tag) => rarityOfTag(tag) === rarity), `${row.Name} rarity chance ${RARITY_TAG_PREFIX}${rarity[0].toUpperCase()}${rarity.slice(1)}`)])) as Record<Rarity, Resolved>);
}

function tierCurves(curves: CurveTables, row: GameBalanceRow) {
  const map = row.ItemCreatorConstants?.EffectChanceScalingCurves;
  const tier = (number: number): Resolved => resolve(curves, refOf(map, (tag) => tag === `SW.Effect.Tier.${number}`), `${row.Name} SW.Effect.Tier.${number}`);
  return together({ first: tier(1), second: tier(2), third: tier(3) });
}

/** The min and max rows of the mob spawn settings, as {min, max} curves. */
function mobRanges(curves: CurveTables, table: string) {
  return Object.entries(MOB_RANGES).map(([key, [min, max]]) => {
    const row = (name: string): Resolved => resolve(curves, { CurveTable: table, RowName: name }, `${MOB_SETTINGS_ASSET} ${name}`);
    return { key, ...together({ min: row(min), max: row(max) }) };
  });
}

/** The mob spawn settings table's object path; undefined (with an issue) when DT_WorldActorDefinition lists none. */
function mobSettingsTable(tables: GuideTables): { table?: string; issues: Issue[] } {
  const asset = tables.worldActor.flatMap((row) => row.AdditionalAssets?.Assets ?? []).find((candidate) => candidate.Name === MOB_SETTINGS_ASSET);
  return asset ? { table: asset.Object, issues: [] } : { issues: [issue("guides-value-missing", `DT_WorldActorDefinition: ${MOB_SETTINGS_ASSET}`)] };
}

const valuesOf = <K extends string>(curves: Readonly<Record<K, Curve>> | undefined): Curve[] => Object.values<Curve>(curves ?? {});

/** The group's values at each level, per part. */
const sampleGroup = <K extends string>(curves: Readonly<Record<K, Curve>> | undefined, levels: readonly number[]): Record<K, number[]> | undefined =>
  curves && (Object.fromEntries(Object.entries<Curve>(curves).map(([key, curve]) => [key, sampleThreat(curve, levels)])) as Record<K, number[]>);

const pick = <K extends string>(values: Readonly<Record<K, readonly number[]>>, index: number): Record<K, number> =>
  Object.fromEntries(Object.entries<readonly number[]>(values).map(([key, series]) => [key, series[index]])) as Record<K, number>;

/** One row per threat level; a group of parts is left out when any curve of it is missing, and reported. */
export function buildThreat(tables: GuideTables, curves: CurveTables): { threat: ThreatRow[]; issues: Issue[] } {
  // Without any curve table the loader has already reported it; a table of recommended levels alone says nothing.
  if (Object.keys(curves).length === 0) return { threat: [], issues: [] };
  const balance = tables.gameBalance.find((row) => row.Name === BALANCE_ROW);
  if (!balance) return { threat: [], issues: [issue("guides-value-missing", `DT_GameBalanceDefinition: ${BALANCE_ROW}`)] };
  const settings = balance.GameBalanceDefinition?.GlobalDifficultyScalingSettings;
  const attack = resolve(curves, settings?.OutgoingDamageModifierCurve, `${balance.Name} OutgoingDamageModifierCurve`);
  const resistance = resolve(curves, settings?.IncomingDamageModifierCurve, `${balance.Name} IncomingDamageModifierCurve`);
  const rarity = rarityCurves(curves, balance);
  const tiers = tierCurves(curves, balance);
  const mobTable = mobSettingsTable(tables);
  const mobs = mobTable.table ? mobRanges(curves, mobTable.table) : [];
  const used = [attack.curve, resistance.curve, ...valuesOf(rarity.curves), ...valuesOf(tiers.curves), ...mobs.flatMap(({ curves: group }) => valuesOf(group))];
  const levels = levelsOf(used.filter((curve): curve is Curve => curve !== undefined));
  const attackValues = attack.curve && sampleThreat(attack.curve, levels);
  const resistanceValues = resistance.curve && sampleThreat(resistance.curve, levels);
  const rarityValues = sampleGroup(rarity.curves, levels);
  const tierValues = sampleGroup(tiers.curves, levels);
  const mobValues = mobs.map(({ key, curves: group }) => ({ key, values: sampleGroup(group, levels) }));
  const perThreat = balance.GameBalanceDefinition?.CharacterLevelsPerThreat;
  const threat = levels.map((level, index): ThreatRow => {
    const at = tierValues && pick(tierValues, index);
    return {
      level,
      ...optional("recommendedLevel", perThreat === undefined ? undefined : (level - 1) * perThreat),
      ...optional("attackPower", attackValues?.[index]),
      ...optional("damageResistance", resistanceValues?.[index]),
      ...optional("effectTiers", at && ([at.first, at.second, at.third] as [number, number, number])),
      ...optional("rarity", rarityValues && pick(rarityValues, index)),
      ...Object.fromEntries(mobValues.flatMap(({ key, values }) => (values ? [[key, pick(values, index)]] : []))),
    };
  });
  return {
    threat,
    issues: [...attack.issues, ...resistance.issues, ...tiers.issues, ...rarity.issues, ...mobTable.issues, ...mobs.flatMap(({ issues }) => issues)],
  };
}

const difficultyIdOf = (row: DifficultyRow): Difficulty | undefined => DIFFICULTIES.find((id) => id === row.Name.toLowerCase());

/** A difficulty's multiplier (the curve's first key); Normal's missing row reads as 1 and is flagged as assumed. */
function multiplier(curves: CurveTables, ref: CurveRefInput, row: DifficultyRow, id: Difficulty): { value?: number; assumed: boolean; issues: Issue[] } {
  const parsed = parseCurveRef(ref);
  const curve = parsed ? findCurve(curves, parsed) : undefined;
  if (parsed && curve) {
    const extra = curve.keys.length > 1 ? [issue("curve-unsupported", `${parsed.table}/${parsed.row}: ${curve.keys.length} keys, only the first is used`)] : [];
    return { value: cleanCurveValue(curve.keys[0].value), assumed: false, issues: [...curveNotes(parsed, curve), ...extra] };
  }
  const where = `DT_DifficultyDefinition ${row.Name}: ${parsed ? `${parsed.table}/${parsed.row}` : "no curve reference"}`;
  return id === "normal"
    ? { value: 1, assumed: true, issues: [issue("guides-value-missing", `${where} (assumed 1)`)] }
    : { assumed: false, issues: [issue("guides-value-missing", where)] };
}

/** The row's own name as a text, for a difficulty the game has no name text for. */
const nameFallback = (row: DifficultyRow): DifficultyData["name"] => ({ html: localizedFrom(() => escapeHtml(row.Name)), untranslated: [] });

function difficultyOf(row: DifficultyRow, id: Difficulty, curves: CurveTables, locales: Locales): { difficulty?: DifficultyData; issues: Issue[] } {
  const definition = row.DifficultyDefinition;
  const incoming = multiplier(curves, definition.DifficultyCurveIncomingDamage, row, id);
  const outgoing = multiplier(curves, definition.DifficultyCurveOutgoingDamage, row, id);
  const name = rowText(locales, row.TypeTextData, NAME);
  const description = rowText(locales, row.TypeTextData, DESCRIPTION);
  const received = rowText(locales, row.TypeTextData, RECEIVED);
  const dealt = rowText(locales, row.TypeTextData, DEALT);
  const issues = [incoming, outgoing, name, description, received, dealt].flatMap((part) => part.issues);
  if (incoming.value === undefined || outgoing.value === undefined) return { issues };
  return {
    difficulty: {
      id,
      scalar: definition.DifficultyScalar,
      name: name.text ?? nameFallback(row),
      ...optional("description", description.text),
      ...optional("received", received.text),
      ...optional("dealt", dealt.text),
      incoming: incoming.value,
      outgoing: outgoing.value,
      ...(incoming.assumed || outgoing.assumed ? { assumed: true } : {}),
    },
    issues,
  };
}

/** Whether the rarity-chance row of this difficulty (same TypeTag) multiplies both Special and Unique by 0; undefined (reported for Low) without such a row. */
function zeroesRareDrops(tables: GuideTables, row: DifficultyRow, id: Difficulty): { zeroed?: boolean; issues: Issue[] } {
  const chance = tables.rarityChance.find((candidate) => candidate.TypeTag.TagName === row.TypeTag.TagName);
  if (!chance) return { issues: id === "low" ? [issue("guides-value-missing", `DT_RarityChanceDefinition: no row for ${row.TypeTag.TagName}`)] : [] };
  const tags = chance.TagList.Tags ?? [];
  const zeroed = (rarity: Rarity): boolean => tags.some((tag) => rarityOfTag(tag.TypeTag.TagName) === rarity && tag.Operation.toLowerCase() === "multiply" && tag.Weight === 0);
  return { zeroed: zeroed("special") && zeroed("unique"), issues: [] };
}

/** One difficulty row as read; rows that are not low, normal or high carry only their issue. */
interface BuiltDifficulty {
  readonly id?: Difficulty;
  readonly difficulty?: DifficultyData;
  readonly noRareDrops?: boolean;
  readonly issues: Issue[];
}

/** Low, Normal and High in that order, each with the game's texts, multipliers and whether it zeroes the rare drops. */
export function buildDifficulty(tables: GuideTables, curves: CurveTables, locales: Locales): { difficulty: DifficultyData[]; issues: Issue[] } {
  const built = tables.difficulty.map((row): BuiltDifficulty => {
    const id = difficultyIdOf(row);
    if (!id) return { issues: [issue("guides-value-missing", `DT_DifficultyDefinition: ${row.Name} is not low, normal or high`)] };
    const drops = zeroesRareDrops(tables, row, id);
    const one = difficultyOf(row, id, curves, locales);
    return { id, difficulty: one.difficulty, noRareDrops: drops.zeroed, issues: [...one.issues, ...drops.issues] };
  });
  const ordered = DIFFICULTIES.flatMap((id) => built.filter((one) => one.id === id));
  return {
    difficulty: ordered.flatMap((one) => (one.difficulty ? [{ ...one.difficulty, ...optional("noRareDrops", one.noRareDrops) }] : [])),
    issues: built.flatMap(({ issues }) => issues),
  };
}
