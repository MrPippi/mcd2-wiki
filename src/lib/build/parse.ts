/** The build page's JSON payload and its check in the browser (no zod: it would ship with the page). */
import { ENCHANT_SLOT_KEYS, POOL_KEYS, SLOT_KEYS, type EnchantSlotKey, type PoolKey, type SlotKey } from "./slots";

export interface BuildOption {
  readonly slug: string;
  readonly name: string;
  /** Folded names in the page and comparison languages, matched against the folded query. */
  readonly search: string;
  readonly icon?: string;
  readonly href: string;
  readonly unique?: true;
  /** The effect or enchantment a unique item always carries. */
  /**
   * `effect` when the built-in bonus is an effect, which takes one of the item's effect places; then `index` is its
   * position in the payload's effect list and `value` its raw magnitude, when known.
   */
  readonly fixed?: { readonly name: string; readonly href: string; readonly effect?: true; readonly index?: number; readonly value?: number };
  /** Positions in the payload's effect list of the effects this item can roll. */
  readonly effects?: readonly number[];
  /**
   * For each effect in `effects`, in the same order, its position in the payload's `tierSets`: the raw tier I/II/III
   * magnitudes on this item (they differ between items, but many items share them).
   */
  readonly effectTiers?: readonly number[];
}

/** How the game prints an effect's raw magnitude (shared/weapon-schema EffectFormat). */
export interface EffectFormatOption {
  readonly percent: boolean;
  readonly multiplier: number;
  readonly offset: number;
  readonly maxFractionDigits: number;
}

/** An effect, in the payload's shared list that items point into. */
export interface EffectOption {
  readonly slug: string;
  readonly name: string;
  readonly search: string;
  readonly icon?: string;
  readonly href: string;
  readonly format?: EffectFormatOption;
}

/** An enchantment a player can put on gear, and the slots it fits. */
export interface EnchantOption {
  readonly slug: string;
  readonly name: string;
  readonly search: string;
  readonly icon?: string;
  readonly href: string;
  readonly slots: readonly EnchantSlotKey[];
  /** The values its description prints at tier I, II and III. */
  readonly tiers: readonly (readonly string[])[];
}

export interface BuildSet {
  readonly slug: string;
  readonly name: string;
  readonly search: string;
  readonly pieces: Readonly<Record<"helmet" | "chest" | "leggings" | "boots", string>>;
}

export interface BuildLabels {
  readonly slots: Readonly<Record<SlotKey, string>>;
  readonly choose: string;
  readonly clear: string;
  readonly search: string;
  readonly noResults: string;
  readonly wholeSet: string;
  readonly equipped: string;
  readonly close: string;
  readonly copied: string;
  readonly copyFailed: string;
  readonly downloadFailed: string;
  /** Has an `{n}` placeholder. */
  readonly dropped: string;
  readonly unsupported: string;
  /** Has a `{version}` placeholder. */
  readonly gameVersion: string;
  /** Has `{old}` and `{current}` placeholders. */
  readonly oldVersion: string;
  readonly effect: string;
  readonly addEffect: string;
  readonly removeEffect: string;
  readonly enchant: string;
  readonly addEnchant: string;
  readonly removeEnchant: string;
  readonly tier: string;
  /** Has a `{name}` placeholder. */
  readonly builtIn: string;
  readonly cardTitle: string;
  readonly siteTitle: string;
  readonly totals: string;
  readonly totalsNote: string;
  readonly totalsEffects: string;
  readonly totalsEnchants: string;
  readonly totalsSum: string;
  readonly totalsBuiltIn: string;
}

export interface BuildPayload {
  /** The game version the item lists match. */
  readonly gameVersion: string;
  readonly pools: Readonly<Record<PoolKey, readonly BuildOption[]>>;
  readonly sets: readonly BuildSet[];
  readonly effects: readonly EffectOption[];
  /** Distinct raw tier I/II/III magnitude lists that items point into. */
  readonly tierSets: readonly (readonly number[])[];
  readonly enchantments: readonly EnchantOption[];
  readonly labels: BuildLabels;
}

const LABEL_KEYS = [
  "choose", "clear", "search", "noResults", "wholeSet", "equipped", "close", "copied", "copyFailed", "downloadFailed", "dropped", "unsupported", "gameVersion", "oldVersion", "effect", "addEffect", "removeEffect", "enchant", "addEnchant", "removeEnchant", "tier", "builtIn", "cardTitle", "siteTitle", "totals", "totalsNote", "totalsEffects", "totalsEnchants", "totalsSum", "totalsBuiltIn",
] as const satisfies readonly Exclude<keyof BuildLabels, "slots">[];
const PIECES = ["helmet", "chest", "leggings", "boots"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value !== "";
const optionalText = (value: unknown): boolean => value === undefined || isText(value);
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const optionalNumber = (value: unknown): boolean => value === undefined || isFiniteNumber(value);
const isNumberList = (value: unknown): boolean => Array.isArray(value) && value.every(isFiniteNumber);
const isIndex = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;
const isTextList = (value: unknown): boolean => Array.isArray(value) && value.every((item) => typeof item === "string");

const isFixed = (value: unknown): boolean =>
  isRecord(value) &&
  isText(value.name) &&
  isText(value.href) &&
  (value.effect === undefined || value.effect === true) &&
  (value.index === undefined || (Number.isInteger(value.index) && (value.index as number) >= 0)) &&
  optionalNumber(value.value);

const isFormat = (value: unknown): boolean =>
  isRecord(value) && typeof value.percent === "boolean" && isFiniteNumber(value.multiplier) && isFiniteNumber(value.offset) && Number.isInteger(value.maxFractionDigits);

const isOption = (value: unknown): value is BuildOption =>
  isRecord(value) &&
  isText(value.slug) &&
  isText(value.name) &&
  typeof value.search === "string" &&
  optionalText(value.icon) &&
  isText(value.href) &&
  (value.unique === undefined || value.unique === true) &&
  (value.fixed === undefined || isFixed(value.fixed)) &&
  (value.effects === undefined || (Array.isArray(value.effects) && value.effects.every((index) => Number.isInteger(index) && index >= 0))) &&
  (value.effectTiers === undefined ||
    (Array.isArray(value.effectTiers) && Array.isArray(value.effects) && value.effectTiers.length === value.effects.length && value.effectTiers.every(isIndex)));

const isEffectOption = (value: unknown): value is EffectOption =>
  isRecord(value) && isText(value.slug) && isText(value.name) && typeof value.search === "string" && optionalText(value.icon) && isText(value.href) && (value.format === undefined || isFormat(value.format));

const isEnchantOption = (value: unknown): value is EnchantOption =>
  isRecord(value) &&
  isText(value.slug) &&
  isText(value.name) &&
  typeof value.search === "string" &&
  optionalText(value.icon) &&
  isText(value.href) &&
  Array.isArray(value.slots) &&
  value.slots.length > 0 &&
  value.slots.every((slot) => (ENCHANT_SLOT_KEYS as readonly unknown[]).includes(slot)) &&
  Array.isArray(value.tiers) &&
  value.tiers.every(isTextList);

const isSet = (value: unknown): value is BuildSet =>
  isRecord(value) && isText(value.slug) && isText(value.name) && typeof value.search === "string" && isRecord(value.pieces) && PIECES.every((piece) => isText((value.pieces as Record<string, unknown>)[piece]));

const isLabels = (value: unknown): value is BuildLabels =>
  isRecord(value) &&
  isRecord(value.slots) &&
  SLOT_KEYS.every((key) => isText((value.slots as Record<string, unknown>)[key])) &&
  LABEL_KEYS.every((key) => isText(value[key])) &&
  (value.dropped as string).includes("{n}") &&
  (value.gameVersion as string).includes("{version}") &&
  ["{old}", "{current}"].every((placeholder) => (value.oldVersion as string).includes(placeholder)) &&
  (value.builtIn as string).includes("{name}");

/** The payload when it has the expected shape, else undefined. */
export function parseBuildPayload(value: unknown): BuildPayload | undefined {
  if (!isRecord(value) || !isText(value.gameVersion) || !isRecord(value.pools) || !Array.isArray(value.sets) || !isLabels(value.labels)) return undefined;
  const pools = value.pools;
  if (!POOL_KEYS.every((pool) => Array.isArray(pools[pool]) && (pools[pool] as unknown[]).every(isOption))) return undefined;
  if (!value.sets.every(isSet)) return undefined;
  if (!Array.isArray(value.enchantments) || !value.enchantments.every(isEnchantOption)) return undefined;
  if (!Array.isArray(value.effects) || !value.effects.every(isEffectOption)) return undefined;
  if (!Array.isArray(value.tierSets) || !value.tierSets.every(isNumberList)) return undefined;
  const effectCount = value.effects.length;
  const tierSetCount = value.tierSets.length;
  const pointsInside = (option: BuildOption): boolean =>
    (option.effects ?? []).every((index) => index < effectCount) &&
    (option.effectTiers ?? []).every((index) => index < tierSetCount) &&
    (option.fixed?.index === undefined || option.fixed.index < effectCount);
  if (!POOL_KEYS.every((pool) => (pools[pool] as BuildOption[]).every(pointsInside))) return undefined;
  return value as unknown as BuildPayload;
}
