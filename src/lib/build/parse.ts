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
  /** `effect` when the built-in bonus is an effect, which takes one of the item's effect places. */
  readonly fixed?: { readonly name: string; readonly href: string; readonly effect?: true };
  /** Positions in the payload's effect list of the effects this item can roll. */
  readonly effects?: readonly number[];
}

/** An effect, in the payload's shared list that items point into. */
export interface EffectOption {
  readonly slug: string;
  readonly name: string;
  readonly search: string;
  readonly icon?: string;
  readonly href: string;
}

/** An enchantment a player can put on gear, and the slots it fits. */
export interface EnchantOption {
  readonly slug: string;
  readonly name: string;
  readonly search: string;
  readonly icon?: string;
  readonly href: string;
  readonly slots: readonly EnchantSlotKey[];
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
}

export interface BuildPayload {
  /** The game version the item lists match. */
  readonly gameVersion: string;
  readonly pools: Readonly<Record<PoolKey, readonly BuildOption[]>>;
  readonly sets: readonly BuildSet[];
  readonly effects: readonly EffectOption[];
  readonly enchantments: readonly EnchantOption[];
  readonly labels: BuildLabels;
}

const LABEL_KEYS = [
  "choose", "clear", "search", "noResults", "wholeSet", "equipped", "close", "copied", "copyFailed", "downloadFailed", "dropped", "unsupported", "gameVersion", "oldVersion", "effect", "addEffect", "removeEffect", "enchant", "addEnchant", "removeEnchant", "tier", "builtIn", "cardTitle", "siteTitle",
] as const satisfies readonly Exclude<keyof BuildLabels, "slots">[];
const PIECES = ["helmet", "chest", "leggings", "boots"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value !== "";
const optionalText = (value: unknown): boolean => value === undefined || isText(value);

const isOption = (value: unknown): value is BuildOption =>
  isRecord(value) &&
  isText(value.slug) &&
  isText(value.name) &&
  typeof value.search === "string" &&
  optionalText(value.icon) &&
  isText(value.href) &&
  (value.unique === undefined || value.unique === true) &&
  (value.fixed === undefined || (isRecord(value.fixed) && isText(value.fixed.name) && isText(value.fixed.href) && (value.fixed.effect === undefined || value.fixed.effect === true))) &&
  (value.effects === undefined || (Array.isArray(value.effects) && value.effects.every((index) => Number.isInteger(index) && index >= 0)));

const isEffectOption = (value: unknown): value is EffectOption =>
  isRecord(value) && isText(value.slug) && isText(value.name) && typeof value.search === "string" && optionalText(value.icon) && isText(value.href);

const isEnchantOption = (value: unknown): value is EnchantOption =>
  isRecord(value) &&
  isText(value.slug) &&
  isText(value.name) &&
  typeof value.search === "string" &&
  optionalText(value.icon) &&
  isText(value.href) &&
  Array.isArray(value.slots) &&
  value.slots.length > 0 &&
  value.slots.every((slot) => (ENCHANT_SLOT_KEYS as readonly unknown[]).includes(slot));

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
  const effectCount = value.effects.length;
  const pointsInside = (option: BuildOption): boolean => (option.effects ?? []).every((index) => index < effectCount);
  if (!POOL_KEYS.every((pool) => (pools[pool] as BuildOption[]).every(pointsInside))) return undefined;
  return value as unknown as BuildPayload;
}
