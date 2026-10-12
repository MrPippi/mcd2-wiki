/** The build in the page URL: `?v=1&gv=1.1.2.0&m=sword&a=horn,,wind…&e=fire-aspect:3&x=sharpness:3~looting:1`. Shared by the browser script and the tests. */
import {
  BUILD_SLOTS,
  EFFECT_SLOT_KEYS,
  ENCHANT_SLOT_KEYS,
  ENCHANT_TIERS,
  type Build,
  type EffectPick,
  type Effects,
  type EffectSlotKey,
  type EnchantPick,
  type Enchants,
  type EnchantSlotKey,
  type EnchantTier,
  type PoolKey,
  type SlotKey,
} from "./slots";

export const BUILD_VERSION = 1;
const VERSION_PARAM = "v";
/** The game version the build was made for, so an old link can say so. */
const GAME_VERSION_PARAM = "gv";
const GAME_VERSION_PATTERN = /^[0-9A-Za-z._-]{1,32}$/;
/** One `slug:tier` per enchantable slot, in ENCHANT_SLOT_KEYS order. */
const ENCHANT_PARAM = "e";
/** Each effect-capable slot's effects, `slug:tier` joined by "~", in EFFECT_SLOT_KEYS order. */
const EFFECT_PARAM = "x";
const EFFECT_SEPARATOR = "~";
const TIER_SEPARATOR = ":";
/**
 * Effects on one item, counting a unique item's built-in effect (user decision 2026-10-13). The data allows more
 * (a Special item's two plus a Soul Storm reward's one, beside any built-in one).
 */
export const MAX_EFFECTS = 2;
/** Effects a player can still add: a built-in effect takes one of the places. */
export const effectCap = (builtIn: boolean): number => (builtIn ? MAX_EFFECTS - 1 : MAX_EFFECTS);
const LIST_SEPARATOR = ",";

/** The slugs each pool offers. */
export type Pools = Readonly<Record<PoolKey, ReadonlySet<string>>>;
/** The enchantment slugs each enchantable slot takes. */
export type EnchantPools = Readonly<Record<EnchantSlotKey, ReadonlySet<string>>>;

/** What a slot's item can roll, and whether it carries a built-in effect. */
export interface EffectRules {
  readonly allowed: (slot: EffectSlotKey, item: string) => ReadonlySet<string>;
  readonly builtIn: (slot: EffectSlotKey, item: string) => boolean;
}

export interface DecodedBuild {
  readonly build: Build;
  readonly enchants: Enchants;
  readonly effects: Effects;
  /** Slugs left out: unknown to their slot, repeated in a list, past its last slot, or an enchantment without its item. */
  readonly dropped: number;
  /** The URL holds a build this version cannot read; `build` is empty. */
  readonly unsupported: boolean;
  /** The game version written in the link, when it is a plain version string. */
  readonly gameVersion?: string;
}

export interface EncodeOptions {
  readonly gameVersion?: string;
  readonly enchants?: Enchants;
  readonly effects?: Effects;
}

const PARAMS: readonly string[] = [...new Set(BUILD_SLOTS.map((slot) => slot.param))];
const ALL_PARAMS: readonly string[] = [VERSION_PARAM, GAME_VERSION_PARAM, ...PARAMS, ENCHANT_PARAM, EFFECT_PARAM];
const NO_ENCHANT_POOLS = Object.fromEntries(ENCHANT_SLOT_KEYS.map((key): [EnchantSlotKey, ReadonlySet<string>] => [key, new Set<string>()])) as Record<EnchantSlotKey, ReadonlySet<string>>;
const NO_EFFECT_RULES: EffectRules = { allowed: () => new Set<string>(), builtIn: () => false };
const slotsFor = (param: string) => BUILD_SLOTS.filter((slot) => slot.param === param).sort((a, b) => a.index - b.index);

/** `param=a,b,,c` with trailing empties dropped and each value escaped; nothing when every value is empty. */
function listParam(param: string, values: readonly string[]): string[] {
  const kept = [...values];
  while (kept.length > 0 && kept[kept.length - 1] === "") kept.pop();
  return kept.length > 0 ? [`${param}=${kept.map(encodeURIComponent).join(LIST_SEPARATOR)}`] : [];
}

/**
 * The query string (without "?") for a build; empty when no slot is filled. Written by hand rather than with
 * URLSearchParams so the list commas stay readable in shared links (each value is still escaped).
 */
export function encodeBuild(build: Build, { gameVersion, enchants = {}, effects = {} }: EncodeOptions = {}): string {
  const items = PARAMS.flatMap((param) => listParam(param, slotsFor(param).map((slot) => build[slot.key] ?? "")));
  if (items.length === 0) return "";
  const enchantValues = ENCHANT_SLOT_KEYS.map((key) => {
    const pick = build[key] === undefined ? undefined : enchants[key];
    return pick ? `${pick.slug}${TIER_SEPARATOR}${pick.tier}` : "";
  });
  const version = gameVersion ? [`${GAME_VERSION_PARAM}=${encodeURIComponent(gameVersion)}`] : [];
  // encodeURIComponent escapes the tier colon; put it back so links stay readable.
  const enchantPart = listParam(ENCHANT_PARAM, enchantValues).map((part) => part.replaceAll("%3A", TIER_SEPARATOR));
  const effectValues = EFFECT_SLOT_KEYS.map((key) =>
    build[key] === undefined ? "" : (effects[key] ?? []).map((pick) => `${pick.slug}${TIER_SEPARATOR}${pick.tier}`).join(EFFECT_SEPARATOR),
  );
  const effectPart = listParam(EFFECT_PARAM, effectValues).map((part) => part.replaceAll("%3A", TIER_SEPARATOR));
  return [`${VERSION_PARAM}=${BUILD_VERSION}`, ...version, ...items, ...enchantPart, ...effectPart].join("&");
}

/** `search` with its build replaced by `build` and other parameters kept: "?…", or empty. */
export function buildSearch(search: string, build: Build, options: EncodeOptions = {}): string {
  const others = new URLSearchParams(search);
  for (const param of ALL_PARAMS) others.delete(param);
  const query = [others.toString(), encodeBuild(build, options)].filter(Boolean).join("&");
  return query ? `?${query}` : "";
}

const gameVersionOf = (params: URLSearchParams): { gameVersion?: string } => {
  const value = params.get(GAME_VERSION_PARAM) ?? "";
  return GAME_VERSION_PATTERN.test(value) ? { gameVersion: value } : {};
};

function decodeItems(params: URLSearchParams, pools: Pools): { build: Build; dropped: number } {
  const build: Partial<Record<SlotKey, string>> = {};
  let dropped = 0;
  for (const param of PARAMS.filter((name) => params.has(name))) {
    const slots = slotsFor(param);
    const used = new Set<string>();
    (params.get(param) ?? "").split(LIST_SEPARATOR).forEach((slug, index) => {
      if (slug === "") return;
      const slot = slots[index];
      if (!slot || !pools[slot.pool].has(slug) || used.has(slug)) {
        dropped += 1;
        return;
      }
      used.add(slug);
      build[slot.key] = slug;
    });
  }
  return { build, dropped };
}

const tierOf = (text: string | undefined): EnchantTier | undefined => ENCHANT_TIERS.find((tier) => String(tier) === text);

/** `slug:tier` with exactly one colon and a tier of 1–3, else undefined. */
function pickOf(value: string): EnchantPick | undefined {
  const parts = value.split(TIER_SEPARATOR);
  const [slug = "", tierText] = parts;
  const tier = parts.length === 2 ? tierOf(tierText) : undefined;
  return slug !== "" && tier !== undefined ? { slug, tier } : undefined;
}

function decodeEnchants(params: URLSearchParams, build: Build, pools: EnchantPools): { enchants: Enchants; dropped: number } {
  const enchants: Partial<Record<EnchantSlotKey, EnchantPick>> = {};
  let dropped = 0;
  (params.get(ENCHANT_PARAM) ?? "").split(LIST_SEPARATOR).forEach((value, index) => {
    if (value === "") return;
    const key = ENCHANT_SLOT_KEYS[index];
    const pick = pickOf(value);
    if (!key || !pick || build[key] === undefined || !pools[key].has(pick.slug)) {
      dropped += 1;
      return;
    }
    enchants[key] = pick;
  });
  return { enchants, dropped };
}

/** One slot's effects: rollable by its item, no repeats, within its cap; the rest counted as dropped. */
function slotEffects(value: string, key: EffectSlotKey, item: string, rules: EffectRules): { picks: EffectPick[]; dropped: number } {
  const cap = effectCap(rules.builtIn(key, item));
  const allowed = rules.allowed(key, item);
  return value.split(EFFECT_SEPARATOR).reduce<{ picks: EffectPick[]; dropped: number }>(
    (found, part) => {
      const pick = pickOf(part);
      const ok = pick && allowed.has(pick.slug) && !found.picks.some((other) => other.slug === pick.slug) && found.picks.length < cap;
      return ok ? { picks: [...found.picks, pick], dropped: found.dropped } : { picks: found.picks, dropped: found.dropped + 1 };
    },
    { picks: [], dropped: 0 },
  );
}

function decodeEffects(params: URLSearchParams, build: Build, rules: EffectRules): { effects: Effects; dropped: number } {
  const effects: Partial<Record<EffectSlotKey, readonly EffectPick[]>> = {};
  let dropped = 0;
  (params.get(EFFECT_PARAM) ?? "").split(LIST_SEPARATOR).forEach((value, index) => {
    if (value === "") return;
    const key = EFFECT_SLOT_KEYS[index];
    const item = key ? build[key] : undefined;
    if (!key || item === undefined) {
      dropped += value.split(EFFECT_SEPARATOR).length;
      return;
    }
    const found = slotEffects(value, key, item, rules);
    if (found.picks.length > 0) effects[key] = found.picks;
    dropped += found.dropped;
  });
  return { effects, dropped };
}

const EMPTY = { build: {}, enchants: {}, effects: {}, dropped: 0 } as const;

/** Reads a build from `location.search`, keeping only what each slot offers. */
export function decodeBuild(search: string, pools: Pools, enchantPools: EnchantPools = NO_ENCHANT_POOLS, effectRules: EffectRules = NO_EFFECT_RULES): DecodedBuild {
  const params = new URLSearchParams(search);
  if (!PARAMS.some((param) => params.has(param))) return { ...EMPTY, unsupported: false };
  if (params.get(VERSION_PARAM) !== String(BUILD_VERSION)) return { ...EMPTY, unsupported: true };
  const items = decodeItems(params, pools);
  const enchants = decodeEnchants(params, items.build, enchantPools);
  const effects = decodeEffects(params, items.build, effectRules);
  return {
    build: items.build,
    enchants: enchants.enchants,
    effects: effects.effects,
    dropped: items.dropped + enchants.dropped + effects.dropped,
    unsupported: false,
    ...gameVersionOf(params),
  };
}
