/**
 * The chance of each rarity for one drop, from the rarity rows a trigger matches (DT_RarityChanceDefinition) and the threat
 * factors (CT_RarityChanceSettings). Pure and shared by the extractor checks and the browser.
 *
 * Rules (rebuilt from the DataTables; the third-party baseline for threat 20 agrees with them in every cell):
 * - the entries for one rarity combine like effect weights do: Set takes the largest, Add sums, Multiply multiplies;
 * - the threat factor scales the combined Set and Add once, and the Multiply product once when there is one, so a Soul Storm
 *   chest's Rare weight is 25 * f * (0.01 * f), not 25 * f * 0.01;
 * - a rarity without Set or Add has no weight; weights are never below 0; all four at 0 means every roll is Common.
 */
import type { RarityFactors, RarityOp } from "./drop-types";

export const RARITIES = ["common", "rare", "special", "unique"] as const;
export type RarityName = (typeof RARITIES)[number];
export type RarityWeights = readonly [number, number, number, number];
export type RarityShares = Readonly<Record<RarityName, number>>;

/** The weight of each rarity for the given rows. */
export function rarityWeights(ops: readonly RarityOp[], factors: RarityFactors): RarityWeights {
  const weight = (index: number): number => {
    const own = ops.filter(([rarity]) => rarity === index);
    const of = (name: string) => own.filter(([, op]) => op === name).map(([, , value]) => value);
    const sets = of("s");
    const multiplies = of("m");
    const factor = factors[index];
    const set = sets.length > 0 ? Math.max(...sets) * factor : 0;
    const add = of("a").reduce((sum, value) => sum + value, 0) * factor;
    const multiply = multiplies.length > 0 ? multiplies.reduce((product, value) => product * value, 1) * factor : 1;
    return Math.max(0, (set + add) * multiply);
  };
  return [weight(0), weight(1), weight(2), weight(3)];
}

/** The weights as chances. */
export function rarityShares(weights: RarityWeights): RarityShares {
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return { common: 1, rare: 0, special: 0, unique: 0 };
  return { common: weights[0] / total, rare: weights[1] / total, special: weights[2] / total, unique: weights[3] / total };
}
