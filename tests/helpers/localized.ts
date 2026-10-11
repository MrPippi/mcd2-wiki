import type { Localized } from "../../scripts/extract/schemas";
import { localizedFrom } from "../../src/lib/lang";

/** Test text in every language: the languages given, and English for the rest. */
export const loc = (partial: Partial<Localized> & { en: string }): Localized =>
  localizedFrom((lang) => partial[lang] ?? partial.en);
