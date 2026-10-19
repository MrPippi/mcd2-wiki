/** A drop chance as the page prints it. Regular mobs give chances far below 0.01%, which would all read the same with two decimals. */

/** Below this chance two decimals hide the digits that tell items apart, so two significant digits are shown instead. */
const SIGNIFICANT_BELOW = 0.001;
/** Chances under this (0.0001%) are not told apart. */
const FLOOR = 1e-6;

export function formatDropOdds(probability: number): string {
  if (probability <= 0) return "0%";
  if (probability < FLOOR) return "<0.0001%";
  const percent = probability * 100;
  return probability < SIGNIFICANT_BELOW ? `${percent.toPrecision(2)}%` : `${percent.toFixed(2)}%`;
}
