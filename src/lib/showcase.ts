import type { Category } from "../../shared/config";
import type { Entry } from "../../shared/schemas";

/** One iconed entry per category for the home page showcase, unique gear first. */
export function pickShowcase(entries: readonly Entry[], categories: readonly Category[]): Entry[] {
  return categories.flatMap((category) => {
    const iconed = entries.filter((entry) => entry.category === category && entry.icon !== undefined);
    const pick = iconed.find((entry) => entry.variant === "unique") ?? iconed[0];
    return pick ? [pick] : [];
  });
}
