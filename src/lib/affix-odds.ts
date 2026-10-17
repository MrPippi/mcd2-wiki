/**
 * The chance that a random effect (and tier) shows up on a generated item, from the weights the game's effect template
 * groups give. Pure and shared by the extractor tests and the browser, so the page and the checks run the same code.
 *
 * Rules (reconstructed from the DataTables, not read from the game's code):
 * - a template's weight comes from the entries that list it: Set entries take the largest, Add entries sum, Multiply
 *   entries multiply; each of the three is scaled once by the tier's threat factor, and the weight is never below 0;
 * - slots are drawn one after another by weight, and drawing an effect takes all its tiers out of the pool.
 */

export type AffixOp = "set" | "add" | "multiply";
export type AffixTier = 1 | 2 | 3;

/** One effect template as the pool lists it: the entries are weights already scaled by the pool group's weight. */
export interface AffixEntry {
  readonly effect: string;
  readonly tier: AffixTier;
  readonly ops: readonly (readonly [AffixOp, number])[];
}

export interface AffixModel {
  readonly entries: readonly AffixEntry[];
}

/** The threat's weight factor for tier I, II and III templates. */
export type TierFactors = readonly [number, number, number];

export interface AffixOdds {
  /** Chance of each template with weight; templates that cannot be drawn are left out. */
  readonly templates: readonly { readonly effect: string; readonly tier: AffixTier; readonly probability: number }[];
  /** Chance of each effect in any tier. */
  readonly effects: readonly { readonly effect: string; readonly probability: number }[];
}

/**
 * A template's weight at the given tier factors. The entries of each operation are combined first (Set takes the largest,
 * Add sums, Multiply multiplies) and the tier factor then scales each of them once, so a template with several Multiply
 * entries is scaled once, not once per entry; the weight is never below 0.
 */
export function entryWeight(entry: AffixEntry, factors: TierFactors): number {
  const factor = factors[entry.tier - 1];
  const weights = (op: AffixOp) => entry.ops.filter(([name]) => name === op).map(([, weight]) => weight);
  const sets = weights("set");
  const adds = weights("add");
  const multiplies = weights("multiply");
  const set = sets.length > 0 ? Math.max(...sets) * factor : 0;
  const add = adds.reduce((sum, weight) => sum + weight, 0) * factor;
  const multiply = multiplies.length > 0 ? multiplies.reduce((product, weight) => product * weight, 1) * factor : 1;
  return Math.max(0, (set + add) * multiply);
}

interface Candidate {
  readonly effect: string;
  readonly weight: number;
}

/** Adds, for every ordered way of drawing `slots` effects, the way's chance to each effect it contains. */
function drawChances(candidates: readonly Candidate[], slots: number): Map<string, number> {
  const chances = new Map<string, number>();
  const visit = (taken: readonly string[], left: number, chance: number): void => {
    const rest = candidates.filter((candidate) => !taken.includes(candidate.effect));
    const total = rest.reduce((sum, candidate) => sum + candidate.weight, 0);
    if (left === 0 || total <= 0) {
      taken.forEach((effect) => chances.set(effect, (chances.get(effect) ?? 0) + chance));
      return;
    }
    rest.forEach((candidate) => visit([...taken, candidate.effect], left - 1, chance * (candidate.weight / total)));
  };
  visit([], slots, 1);
  return chances;
}

/** The odds of each template and effect; `without` lists effects the item already has, which never roll again. */
export function affixOdds(model: AffixModel, factors: TierFactors, slots: number, without: readonly string[] = []): AffixOdds {
  const weighted = model.entries.filter((entry) => !without.includes(entry.effect)).map((entry) => ({ entry, weight: entryWeight(entry, factors) })).filter(({ weight }) => weight > 0);
  const totals = weighted.reduce((sums, { entry, weight }) => new Map(sums).set(entry.effect, (sums.get(entry.effect) ?? 0) + weight), new Map<string, number>());
  const chances = drawChances([...totals].map(([effect, weight]) => ({ effect, weight })), Math.max(0, slots));
  return {
    templates: weighted.map(({ entry, weight }) => ({
      effect: entry.effect,
      tier: entry.tier,
      // Once an effect is drawn, its tier follows the tiers' weights.
      probability: (chances.get(entry.effect) ?? 0) * (weight / (totals.get(entry.effect) ?? 1)),
    })),
    effects: [...totals.keys()].map((effect) => ({ effect, probability: chances.get(effect) ?? 0 })),
  };
}

/** The generated data file: pool models by hash, and per item its model, built-in effects and rarities it can roll. */
export interface AffixFile {
  readonly levels: readonly number[];
  /** The tier factors of each threat level, in the order of `levels`. */
  readonly tierFactors: readonly TierFactors[];
  readonly models: Readonly<Record<string, AffixModel>>;
  readonly items: Readonly<Record<string, AffixItemData>>;
}

export interface AffixItemData {
  readonly model: string;
  readonly fixed: readonly string[];
  readonly rarities: readonly { readonly rarity: string; readonly slots: number; readonly bonusSlots: number }[];
}

export interface AffixSelection {
  readonly level: number;
  readonly rarity: string;
  /** The Soul Storm reward bonus slot. */
  readonly bonus: boolean;
}

/** The odds for an item at a threat level and rarity; undefined for an item, level or rarity the data does not have. */
export function itemOdds(file: AffixFile, slug: string, selection: AffixSelection): AffixOdds | undefined {
  const item = Object.hasOwn(file.items, slug) ? file.items[slug] : undefined;
  const model = item && Object.hasOwn(file.models, item.model) ? file.models[item.model] : undefined;
  const rarity = item?.rarities.find((found) => found.rarity === selection.rarity);
  const factors = file.tierFactors[file.levels.indexOf(selection.level)];
  if (!item || !model || !rarity || !factors) return undefined;
  return affixOdds(model, factors, rarity.slots + (selection.bonus ? rarity.bonusSlots : 0), item.fixed);
}

/** A chance as the page prints it: two decimals, "<0.01%" for the tiny, "0%" for none. */
export function formatOdds(probability: number): string {
  if (probability <= 0) return "0%";
  if (probability < 0.0001) return "<0.01%";
  return `${(probability * 100).toFixed(2)}%`;
}
