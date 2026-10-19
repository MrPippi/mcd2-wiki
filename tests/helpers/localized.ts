import type { Localized } from "../../shared/schemas";
import { localizedFrom } from "../../shared/lang";

/** Test text in every language: the languages given, and English for the rest. */
export const loc = (partial: Partial<Localized> & { en: string }): Localized =>
  localizedFrom((lang) => partial[lang] ?? partial.en);
