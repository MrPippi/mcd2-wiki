/**
 * The chance that one trigger of a loot source (a chest opened, a mob killed, a quest reward batch) gives a chosen item at
 * least once. Pure and shared by the extractor checks and the browser, so the pages and the checks run the same code.
 *
 * Rules (rebuilt from the DataTables; the third-party baseline for threat 20 on Normal agrees with them, see the design notes):
 * - a slot makes `rolls` random rolls that each succeed with `chance`, then `guaranteed` draws; every draw picks from the
 *   pool by weight. Rolls and guaranteed draws are the same kind of draw, so only their number matters;
 * - a draw leaves out the items whose group is among the slot's latest `history` drops (equipment: weapon type, armor piece)
 *   and, in a one-of-a-kind slot, the items already drawn in this trigger; with nothing left the slot stops;
 * - the drawn item then rolls its rarity: a Unique roll turns a base item into its Unique variant, an item that is Unique by
 *   itself is always Unique;
 * - the slots are independent, so the chances combine as 1 - the product of the misses.
 */
import { rarityShares, rarityWeights, type RarityShares } from "./drop-rarity";
import type { DropFile, DropProfile, DropRow, DropSelection, DropSlot, DropSlotRule, TargetRarity } from "./drop-types";

/** The most draws one slot follows; a slot with more is cut here (the extractor reports it). */
export const MAX_DRAWS = 12;
const NO_RULE: DropSlotRule = { history: 0, oneOfAKind: false };

interface Candidate {
  readonly item: number;
  readonly group: string;
  readonly weight: number;
  /** The chance that a pick of this item becomes the target. */
  readonly hit: number;
}

interface Chances {
  readonly shares: RarityShares;
  readonly rarity: TargetRarity;
}

/** The chance that picking `pick` gives `target`, once its rarity is rolled. */
function hitOf(file: DropFile, pick: number, target: number, { shares, rarity }: Chances): number {
  const item = file.items[pick];
  const goal = file.items[target];
  if (item.opaque) return 0;
  if (pick === target) {
    if (goal.unique) return rarity === "any" || rarity === "unique" ? 1 : 0;
    if (goal.sub === undefined) return rarity === "any" ? 1 : 0;
    return rarity === "any" ? 1 - shares.unique : rarity === "unique" ? 0 : shares[rarity];
  }
  return item.sub === target && (rarity === "any" || rarity === "unique") ? shares.unique : 0;
}

/** The chance of exactly `k` successes in `n` rolls of `p`. */
function binomial(n: number, k: number, p: number): number {
  const ways = Array.from({ length: k }, (_, index) => (n - k + index + 1) / (index + 1)).reduce((product, step) => product * step, 1);
  return ways * p ** k * (1 - p) ** (n - k);
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

/** The chance that one trigger of the slot gives the target at least once; `pool` is the slot's (item, weight) list. */
export function slotOdds(file: DropFile, slot: DropSlot, pool: readonly (readonly [number, number])[], target: number, chances: Chances): number {
  const candidates = pool
    .filter(([, weight]) => weight > 0)
    .map(([item, weight]): Candidate => ({ item, group: file.items[item].group, weight, hit: hitOf(file, item, target, chances) }));
  if (!candidates.some((one) => one.hit > 0)) return 0;
  const rule = Object.hasOwn(file.slots, slot.slot) ? file.slots[slot.slot] : NO_RULE;
  const rolls = Math.min(MAX_DRAWS, slot.rolls);
  const miss = missChances(candidates, rule);
  return Array.from({ length: rolls + 1 }, (_, successes) => {
    const share = rolls === 0 ? 1 : binomial(rolls, successes, slot.chance);
    return share * (1 - miss(Math.min(MAX_DRAWS, successes + slot.guaranteed)));
  }).reduce((sum, value) => sum + value, 0);
}

/** The rarity chances of a profile at a threat level and difficulty; undefined for a level or difficulty the file does not have. */
export function profileShares(file: DropFile, profile: DropProfile, selection: DropSelection): RarityShares | undefined {
  const factors = file.rarityFactors[file.levels.indexOf(selection.level)];
  const difficulty = Object.hasOwn(file.difficulties, selection.difficulty) ? file.difficulties[selection.difficulty] : undefined;
  return factors && difficulty ? rarityShares(rarityWeights([...profile.rarity, ...difficulty], factors)) : undefined;
}

/** The chance that one trigger under the profile gives the target at least once. */
export function profileOdds(file: DropFile, profile: DropProfile, target: number, selection: DropSelection): number {
  const shares = profileShares(file, profile, selection);
  if (!shares) return 0;
  const miss = profile.slots.reduce((product, slot) => {
    const pool = Object.hasOwn(file.pools, slot.pool) ? file.pools[slot.pool] : [];
    return product * (1 - slotOdds(file, slot, pool, target, { shares, rarity: selection.rarity }));
  }, 1);
  return 1 - miss;
}

/** Every source and area that can give the item, best first; items, levels and difficulties the file does not know give nothing. */
export function itemRows(file: DropFile, key: string, selection: DropSelection): DropRow[] {
  const target = file.items.findIndex((item) => item.key === key);
  if (target === -1) return [];
  return file.sources
    .flatMap((source) =>
      source.contexts.map(([area, profile]): DropRow => ({
        source: source.id,
        area,
        probability: Object.hasOwn(file.profiles, profile) ? profileOdds(file, file.profiles[profile], target, selection) : 0,
      })),
    )
    .filter((row) => row.probability > 0)
    .sort((a, b) => b.probability - a.probability);
}
