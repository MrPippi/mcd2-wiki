import type { Category } from "../../scripts/extract/config";
import type { ArmorSet, Entry } from "../../scripts/extract/schemas";
import { allArmorSets, listedIn } from "./data";

const CATALOG_DIGITS = 3;

/** A specimen number as printed on its plate, e.g. 7 → "007". */
export const catalogLabel = (n: number): string => n.toString().padStart(CATALOG_DIGITS, "0");

/** The entry's 1-based place in its category list, or undefined when it is not published there. */
export function entryNumber(entry: Entry): number | undefined {
  const index = listedIn(entry.category).findIndex((candidate) => candidate.slug === entry.slug);
  return index === -1 ? undefined : index + 1;
}

/** The set's 1-based place in the armor set list, or undefined when it is unknown. */
export function setNumber(set: ArmorSet): number | undefined {
  const index = allArmorSets.findIndex((candidate) => candidate.slug === set.slug);
  return index === -1 ? undefined : index + 1;
}

/** How many entries a category page lists: armor lists sets, everything else lists entries. */
export const categoryCount = (category: Category): number =>
  category === "armor" ? allArmorSets.length : listedIn(category).length;
