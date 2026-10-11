/**
 * Game texts known to read wrongly in some languages once their values are filled (for example a percentage on a
 * count word). Per the site's policy those languages show the English text and are marked untranslated.
 */
import { z } from "zod";
import { CATEGORIES, LANGS } from "./config";
import rawOverrides from "./english-overrides.json";
import { localizedFrom } from "../../src/lib/lang";
import type { Entry } from "./schemas";

const OverrideSchema = z.object({
  category: z.enum(CATEGORIES),
  id: z.string().min(1),
  field: z.enum(["description", "descriptionLong", "unlock"]),
  langs: z.array(z.enum(LANGS)).min(1),
  reason: z.string().min(1),
});
export type EnglishOverride = z.infer<typeof OverrideSchema>;

export const ENGLISH_OVERRIDES: readonly EnglishOverride[] = z.array(OverrideSchema).parse(rawOverrides);

function applyOne(entry: Entry, override: EnglishOverride): Entry {
  const text = entry[override.field];
  if (!text) return entry;
  const replaced = localizedFrom((lang) => (override.langs.includes(lang) ? text.en : text[lang]));
  const untranslated = [...new Set([...(entry.untranslated ?? []), ...override.langs])];
  return { ...entry, [override.field]: replaced, untranslated };
}

/** Entries with the listed texts shown in English in the listed languages. */
export function applyEnglishOverrides(entries: readonly Entry[], overrides: readonly EnglishOverride[] = ENGLISH_OVERRIDES): Entry[] {
  return entries.map((entry) =>
    overrides
      .filter((override) => override.category === entry.category && override.id.toLowerCase() === entry.id.toLowerCase())
      .reduce(applyOne, entry),
  );
}
