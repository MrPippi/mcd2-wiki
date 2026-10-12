/** The build in the page URL: `?v=1&gv=1.1.2.0&m=sword&a=horn,,wind…&e=fire-aspect:3`. Shared by the browser script and the tests. */
import {
  BUILD_SLOTS,
  ENCHANT_SLOT_KEYS,
  ENCHANT_TIERS,
  type Build,
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
const TIER_SEPARATOR = ":";
const LIST_SEPARATOR = ",";

/** The slugs each pool offers. */
export type Pools = Readonly<Record<PoolKey, ReadonlySet<string>>>;
/** The enchantment slugs each enchantable slot takes. */
export type EnchantPools = Readonly<Record<EnchantSlotKey, ReadonlySet<string>>>;

export interface DecodedBuild {
  readonly build: Build;
  readonly enchants: Enchants;
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
}

const PARAMS: readonly string[] = [...new Set(BUILD_SLOTS.map((slot) => slot.param))];
const ALL_PARAMS: readonly string[] = [VERSION_PARAM, GAME_VERSION_PARAM, ...PARAMS, ENCHANT_PARAM];
const NO_ENCHANT_POOLS = Object.fromEntries(ENCHANT_SLOT_KEYS.map((key): [EnchantSlotKey, ReadonlySet<string>] => [key, new Set<string>()])) as Record<EnchantSlotKey, ReadonlySet<string>>;
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
export function encodeBuild(build: Build, { gameVersion, enchants = {} }: EncodeOptions = {}): string {
  const items = PARAMS.flatMap((param) => listParam(param, slotsFor(param).map((slot) => build[slot.key] ?? "")));
  if (items.length === 0) return "";
  const enchantValues = ENCHANT_SLOT_KEYS.map((key) => {
    const pick = build[key] === undefined ? undefined : enchants[key];
    return pick ? `${pick.slug}${TIER_SEPARATOR}${pick.tier}` : "";
  });
  const version = gameVersion ? [`${GAME_VERSION_PARAM}=${encodeURIComponent(gameVersion)}`] : [];
  // encodeURIComponent escapes the tier colon; put it back so links stay readable.
  const enchantPart = listParam(ENCHANT_PARAM, enchantValues).map((part) => part.replaceAll("%3A", TIER_SEPARATOR));
  return [`${VERSION_PARAM}=${BUILD_VERSION}`, ...version, ...items, ...enchantPart].join("&");
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

function decodeEnchants(params: URLSearchParams, build: Build, pools: EnchantPools): { enchants: Enchants; dropped: number } {
  const enchants: Partial<Record<EnchantSlotKey, EnchantPick>> = {};
  let dropped = 0;
  (params.get(ENCHANT_PARAM) ?? "").split(LIST_SEPARATOR).forEach((value, index) => {
    if (value === "") return;
    const key = ENCHANT_SLOT_KEYS[index];
    const parts = value.split(TIER_SEPARATOR);
    const [slug = "", tierText] = parts;
    const tier = parts.length === 2 ? tierOf(tierText) : undefined;
    if (!key || build[key] === undefined || !pools[key].has(slug) || tier === undefined) {
      dropped += 1;
      return;
    }
    enchants[key] = { slug, tier };
  });
  return { enchants, dropped };
}

/** Reads a build from `location.search`, keeping only what each slot offers. */
export function decodeBuild(search: string, pools: Pools, enchantPools: EnchantPools = NO_ENCHANT_POOLS): DecodedBuild {
  const params = new URLSearchParams(search);
  if (!PARAMS.some((param) => params.has(param))) return { build: {}, enchants: {}, dropped: 0, unsupported: false };
  if (params.get(VERSION_PARAM) !== String(BUILD_VERSION)) return { build: {}, enchants: {}, dropped: 0, unsupported: true };
  const items = decodeItems(params, pools);
  const enchants = decodeEnchants(params, items.build, enchantPools);
  return { build: items.build, enchants: enchants.enchants, dropped: items.dropped + enchants.dropped, unsupported: false, ...gameVersionOf(params) };
}
