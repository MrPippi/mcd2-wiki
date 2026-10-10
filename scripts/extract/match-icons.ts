import path from "node:path";

const DROP_TOKENS: ReadonlySet<string> = new Set([
  "t", "ui", "icon", "png", "status", "enchantment", "effect", "buff", "talisman", "cosmetic", "skin",
]);
/**
 * Talisman icons come in tiers 1–3, written as "Icon2" or glued to the last word ("Cooldown2").
 * Tier 1 is the base icon; higher tiers stay distinct. "Unique1" is a variant, not a tier.
 */
const tierTokens = (token: string): string[] => {
  const match = /^([a-z]+?)([1-3])$/.exec(token);
  if (!match || match[1] === "unique") return [token];
  const word = match[1] === "icon" ? [] : [match[1]];
  return match[2] === "1" ? word : [...word, `tier${match[2]}`];
};
const TOKEN_ALIASES: Readonly<Record<string, string>> = { chestplate: "chest", gauntlets: "gauntlet" };
const MAX_PERMUTATION_TOKENS = 6;
const ID_PREFIX = /^(?:Artifact_|EnchantmentBook_)/;

export type IconIndex = ReadonlyMap<string, readonly string[]>;
export type IconOverrides = Readonly<Record<string, string | null>>;
export interface MatchOptions {
  readonly fallbackToBase?: boolean;
}
export type IconMatch =
  | { readonly kind: "matched"; readonly file: string; readonly via: "auto" | "override" | "fallback" }
  | { readonly kind: "none" }
  | { readonly kind: "missing" }
  | { readonly kind: "ambiguous"; readonly candidates: readonly string[] };

export function tokenize(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .split(/[_\s-]+/)
    .map((token) => token.toLowerCase())
    .flatMap(tierTokens)
    .filter((token) => token !== "" && !DROP_TOKENS.has(token))
    .map((token) => TOKEN_ALIASES[token] ?? token)
    .map((token) => (/^unique\d*$/.test(token) ? "unique" : token));
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

export function buildIconIndex(files: readonly string[]): IconIndex {
  const index = new Map<string, string[]>();
  for (const file of files) {
    const tokens = tokenize(path.posix.basename(file, path.posix.extname(file)));
    if (tokens.length === 0 || tokens.length > MAX_PERMUTATION_TOKENS) continue;
    const keys = new Set(permutations(tokens).map((perm) => perm.join("")));
    for (const key of keys) index.set(key, [...(index.get(key) ?? []), file]);
  }
  return index;
}

const candidatesFor = (name: string, index: IconIndex): string[] => [
  ...new Set(index.get(tokenize(name).join("")) ?? []),
];

export function matchIcon(id: string, index: IconIndex, overrides: IconOverrides, options: MatchOptions = {}): IconMatch {
  if (Object.hasOwn(overrides, id)) {
    const file = overrides[id];
    return file === null ? { kind: "none" } : { kind: "matched", file, via: "override" };
  }
  const name = id.replace(ID_PREFIX, "");
  const candidates = candidatesFor(name, index);
  if (candidates.length === 1) return { kind: "matched", file: candidates[0], via: "auto" };
  if (candidates.length > 1) return { kind: "ambiguous", candidates };
  const base = name.split("_")[0];
  const fallback = options.fallbackToBase && base !== name ? candidatesFor(base, index) : [];
  return fallback.length === 1 ? { kind: "matched", file: fallback[0], via: "fallback" } : { kind: "missing" };
}
