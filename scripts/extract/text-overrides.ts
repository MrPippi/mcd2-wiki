/**
 * Game texts known to read wrongly in some languages once their values are filled (for example a percentage on a
 * count word). Per the site's policy those languages show the English text and are marked untranslated.
 */
import { z } from "zod";
import { CATEGORIES, LANGS } from "../../shared/config";
import rawOverrides from "./english-overrides.json";
import { localizedFrom } from "../../shared/lang";
import type { Entry } from "../../shared/schemas";
import type { Lang } from "../../shared/lang";

const OverrideSchema = z.object({
  category: z.enum(CATEGORIES),
  id: z.string().min(1),
  field: z.enum(["description", "descriptionLong", "unlock"]),
  langs: z.array(z.enum(LANGS)).min(1),
  reason: z.string().min(1),
  /** Correct text for a language, instead of English. `{0}` stands for the value slot of that number. */
  replacements: z.partialRecord(z.enum(LANGS), z.string().min(1)).optional(),
});
export type EnglishOverride = z.infer<typeof OverrideSchema>;

export const ENGLISH_OVERRIDES: readonly EnglishOverride[] = z.array(OverrideSchema).parse(rawOverrides);

const SLOT_SPAN = /<span class="placeholder" data-slot="(\d+)">[^<]*<\/span>/g;

/** The English text's value markup by slot number, so a replacement can reuse it. */
function slotMarkup(english: string): ReadonlyMap<string, string> {
  return new Map([...english.matchAll(SLOT_SPAN)].map((match) => [match[1] ?? "", match[0]]));
}

function fillSlots(replacement: string, english: string): string {
  const slots = slotMarkup(english);
  return replacement.replace(/\{(\d+)\}/g, (token, slot: string) => slots.get(slot) ?? token);
}

function applyOne(entry: Entry, override: EnglishOverride): Entry {
  const text = entry[override.field];
  if (!text) return entry;
  const textFor = (lang: Lang): string => {
    const replacement = override.replacements?.[lang];
    return replacement === undefined ? text.en : fillSlots(replacement, text.en);
  };
  const replaced = localizedFrom((lang) => (override.langs.includes(lang) ? textFor(lang) : text[lang]));
  const replacedLangs = override.langs.filter((lang) => override.replacements?.[lang] !== undefined);
  const englishLangs = override.langs.filter((lang) => !replacedLangs.includes(lang));
  const kept = (entry.untranslated ?? []).filter((lang) => !replacedLangs.includes(lang));
  const untranslated = [...new Set([...kept, ...englishLangs])];
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
