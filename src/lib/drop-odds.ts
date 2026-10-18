/**
 * The chance that one trigger of a loot source (a chest opened, a mob killed, a quest reward batch) gives a chosen item, or any
 * of a chosen set of items, at least once. Pure and shared by the extractor checks and the browser, so the pages and the checks
 * run the same code.
 *
 * Rules (rebuilt from the DataTables; the third-party baseline for threat 20 on Normal agrees with them, see the design notes):
 * - a slot makes `rolls` random rolls that each succeed with `chance`, then `guaranteed` draws; every draw picks from the
 *   pool by weight. Rolls and guaranteed draws are the same kind of draw, so only their number matters;
 * - a draw leaves out the items whose group is among the slot's latest `history` drops (equipment: weapon type, armor piece)
 *   and, in a one-of-a-kind slot, the items already drawn in this trigger; with nothing left the slot stops;
 * - the drawn item then rolls its rarity among the rarities it may have: a Unique roll turns a base item into its Unique
 *   variant, an item that is Unique by itself is always Unique;
 * - the slots are independent, so the chances combine as 1 - the product of the misses.
 */
import { rarityShares, rarityWeights, type RarityName, type RarityShares } from "./drop-rarity";
import type { DropFile, DropProfile, DropRow, DropSelection, DropSlot, DropSlotRule, TargetRarity } from "./drop-types";

/** The most draws one slot may make; the extractor leaves a slot with more out and says so, and the calculation refuses it. */
export const MAX_DRAWS = 12;
/** The most (history, items drawn) states one slot may need; the extractor leaves a slot over it out and says so. */
export const MAX_STATES = 200_000;
const NO_RULE: DropSlotRule = { history: 0, oneOfAKind: false };
const RARITY_BITS: Readonly<Record<RarityName, number>> = { common: 1, rare: 2, special: 4, unique: 8 };

interface Candidate {
  readonly item: number;
  readonly group: string;
  readonly weight: number;
  /** The chance that a pick of this item becomes one of the targets. */
  readonly hit: number;
}

interface Chances {
  readonly shares: RarityShares;
  readonly rarity: TargetRarity;
}

/** The shares limited to the rarities the item may have; with none of them weighted, the lowest allowed rarity is certain. */
function limitedShares(shares: RarityShares, mask: number): RarityShares {
  const kept = (name: RarityName): number => ((mask & RARITY_BITS[name]) === 0 ? 0 : shares[name]);
  const total = kept("common") + kept("rare") + kept("special") + kept("unique");
  if (total <= 0) {
    const lowest = (["common", "rare", "special", "unique"] as const).find((name) => (mask & RARITY_BITS[name]) !== 0) ?? "common";
    return { common: 0, rare: 0, special: 0, unique: 0, [lowest]: 1 };
  }
  return { common: kept("common") / total, rare: kept("rare") / total, special: kept("special") / total, unique: kept("unique") / total };
}

/** The chance that picking `pick` gives `target`, once its rarity is rolled. */
function hitOne(file: DropFile, pick: number, target: number, { shares, rarity }: Chances): number {
  const item = file.items[pick];
  if (item.opaque) return 0;
  if (item.allowed === undefined) return pick === target && rarity === "any" ? 1 : 0;
  const own = limitedShares(shares, item.allowed);
  if (pick === target) {
    if (item.sub === undefined) return rarity === "any" ? 1 : own[rarity];
    return rarity === "any" ? 1 - own.unique : rarity === "unique" ? 0 : own[rarity];
  }
  return item.sub === target && (rarity === "any" || rarity === "unique") ? own.unique : 0;
}

/** The chance that picking `pick` gives any of the targets; the outcomes exclude each other, so they add up. */
const hitOf = (file: DropFile, pick: number, targets: readonly number[], chances: Chances): number =>
  Math.min(1, targets.reduce((sum, target) => sum + hitOne(file, pick, target, chances), 0));

/** The chance of exactly `k` successes in `n` rolls of `p`. */
function binomial(n: number, k: number, p: number): number {
  const ways = Array.from({ length: k }, (_, index) => (n - k + index + 1) / (index + 1)).reduce((product, step) => product * step, 1);
  return ways * p ** k * (1 - p) ** (n - k);
}

/**
 * An upper bound, whatever the targets, of the states following `draws` draws from `items` items in `groups` groups can take. In
 * a one-of-a-kind slot a state follows from the order of the items drawn so far, so it is the number of such orders.
 */
export function slotStates(items: number, groups: number, rule: DropSlotRule, draws: number): number {
  if (!rule.oneOfAKind) return Math.max(1, draws) * (rule.history > 0 ? (groups + 1) ** Math.min(rule.history, draws) : 1);
  let orders = 1;
  let total = 1;
  for (let k = 1; k <= draws; k += 1) {
    orders *= Math.max(0, items - k + 1);
    total += orders;
  }
  return total;
}

/**
 * Candidates with the same group and the same hit chance only differ in weight, which is all the draws can tell apart, unless
 * the slot never gives an item twice: those are merged, so a pool of forty weapons draws like one of a few groups.
 */
function mergeAlike(candidates: readonly Candidate[], rule: DropSlotRule): readonly Candidate[] {
  if (rule.oneOfAKind) return candidates;
  const merged = new Map<string, Candidate>();
  for (const one of candidates) {
    const key = `${one.group}|${one.hit}`;
    const known = merged.get(key);
    merged.set(key, known ? { ...known, weight: known.weight + one.weight } : one);
  }
  return [...merged.values()];
}

/** The chance of no hit in `draws` draws, given the latest groups drawn and the items already drawn; one memo serves every number of draws. */
function missChances(candidates: readonly Candidate[], rule: DropSlotRule): (draws: number) => number {
  const pool = mergeAlike(candidates, rule);
  const memo = new Map<string, number>();
  const miss = (left: number, history: readonly string[], drawn: readonly number[]): number => {
    if (left === 0) return 1;
    const key = `${left}|${history.join(",")}|${drawn.join(",")}`;
    const known = memo.get(key);
    if (known !== undefined) return known;
    const open = pool.filter((one) => !history.includes(one.group) && !drawn.includes(one.item));
    const total = open.reduce((sum, one) => sum + one.weight, 0);
    const value =
      total > 0
        ? open.reduce((sum, one) => {
            const nextHistory = rule.history > 0 ? [one.group, ...history].slice(0, rule.history) : [];
            const nextDrawn = rule.oneOfAKind ? [...drawn, one.item].sort((a, b) => a - b) : [];
            return sum + (one.weight / total) * (1 - one.hit) * miss(left - 1, nextHistory, nextDrawn);
          }, 0)
        : 1;
    memo.set(key, value);
    return value;
  };
  return (draws) => miss(draws, [], []);
}

/** The chance that one trigger of the slot gives any of the targets at least once; `pool` is the slot's (item, weight) list. */
export function slotOdds(file: DropFile, slot: DropSlot, pool: readonly (readonly [number, number])[], targets: readonly number[], chances: Chances): number {
  if (slot.guaranteed + slot.rolls > MAX_DRAWS) throw new RangeError(`a slot draws at most ${MAX_DRAWS} times, this one ${slot.guaranteed + slot.rolls}`);
  const candidates = pool
    .filter(([, weight]) => weight > 0)
    .map(([item, weight]): Candidate => ({ item, group: file.items[item].group, weight, hit: hitOf(file, item, targets, chances) }));
  if (!candidates.some((one) => one.hit > 0)) return 0;
  const rule = Object.hasOwn(file.slots, slot.slot) ? file.slots[slot.slot] : NO_RULE;
  const miss = missChances(candidates, rule);
  return Array.from({ length: slot.rolls + 1 }, (_, successes) => {
    const share = slot.rolls === 0 ? 1 : binomial(slot.rolls, successes, slot.chance);
    return share * (1 - miss(successes + slot.guaranteed));
  }).reduce((sum, value) => sum + value, 0);
}

/** The rarity chances of a profile at a threat level and difficulty; undefined for a level or difficulty the file does not have. */
export function profileShares(file: DropFile, profile: DropProfile, selection: DropSelection): RarityShares | undefined {
  const factors = file.rarityFactors[file.levels.indexOf(selection.level)];
  const difficulty = Object.hasOwn(file.difficulties, selection.difficulty) ? file.difficulties[selection.difficulty] : undefined;
  return factors && difficulty ? rarityShares(rarityWeights([...profile.rarity, ...difficulty], factors)) : undefined;
}

const cache = new WeakMap<DropFile, WeakMap<DropProfile, Map<string, number>>>();

/** The chance that one trigger under the profile gives any of the targets at least once; remembered per file, profile, targets and selection. */
export function profileOdds(file: DropFile, profile: DropProfile, targets: readonly number[], selection: DropSelection): number {
  const byProfile = cache.get(file) ?? new WeakMap<DropProfile, Map<string, number>>();
  cache.set(file, byProfile);
  const known = byProfile.get(profile) ?? new Map<string, number>();
  byProfile.set(profile, known);
  const key = `${[...targets].sort((a, b) => a - b).join(",")}|${selection.level}|${selection.difficulty}|${selection.rarity}`;
  const found = known.get(key);
  if (found !== undefined) return found;
  const shares = profileShares(file, profile, selection);
  const miss = shares
    ? profile.slots.reduce((product, slot) => {
        const pool = Object.hasOwn(file.pools, slot.pool) ? file.pools[slot.pool] : [];
        return product * (1 - slotOdds(file, slot, pool, targets, { shares, rarity: selection.rarity }));
      }, 1)
    : 1;
  known.set(key, 1 - miss);
  return 1 - miss;
}

/** Every source and area that can give the item (or any of several items), best first; unknown items, levels and difficulties give nothing. */
export function itemRows(file: DropFile, keys: string | readonly string[], selection: DropSelection): DropRow[] {
  const wanted = typeof keys === "string" ? [keys] : keys;
  const targets = wanted.flatMap((key) => {
    const at = file.items.findIndex((item) => item.key === key);
    return at === -1 ? [] : [at];
  });
  if (targets.length === 0) return [];
  return file.sources
    .flatMap((source) =>
      source.contexts.map(([area, profile]): DropRow => ({
        source: source.id,
        area,
        probability: Object.hasOwn(file.profiles, profile) ? profileOdds(file, file.profiles[profile], targets, selection) : 0,
      })),
    )
    .filter((row) => row.probability > 0)
    .sort((a, b) => b.probability - a.probability);
}
