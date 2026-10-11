import { TalismanDataSchema, type TalismanData } from "../../scripts/extract/gear-schema";
import rawTalismans from "../data/talismans.json";

/** Talisman levels read from the game's DataTables by `npm run extract`. */
export const talismanData: TalismanData = TalismanDataSchema.parse(rawTalismans);

/** A talisman's description values at levels 1–3; undefined unless every level has them. */
export function talismanTiers(slug: string): string[][] | undefined {
  const levels = talismanData[slug]?.levels ?? [];
  const values = levels.map((level) => level.values);
  return values.length > 0 && values.every((value): value is string[] => value !== undefined) ? values : undefined;
}
