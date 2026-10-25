/** How the game prints an effect's raw magnitude. Pure (type-only imports), so the build page's browser script can use it. */
import type { EffectFormat } from "../../shared/weapon-schema";

/** A magnitude the way the game prints it: scaled, offset, as a percentage when the effect says so. */
export function formatMagnitude(value: number, format: EffectFormat | undefined): string {
  if (!format) return String(value);
  const scaled = (value * format.multiplier + format.offset) * (format.percent ? 100 : 1);
  const factor = 10 ** format.maxFractionDigits;
  const rounded = Math.round(scaled * factor) / factor;
  return format.percent ? `${rounded}%` : String(rounded);
}
