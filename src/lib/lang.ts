import { LANGS, LANG_META, type Lang } from "../../scripts/extract/langs";
import type { Localized } from "../../scripts/extract/schemas";

export type { Lang };

/** The language shown beside a page's own language in compare mode: English pairs with Traditional Chinese, everything else with English. */
export const compareLang = (lang: Lang): Lang => (lang === "en" ? "zh" : "en");

export const pick = (value: Localized, lang: Lang): string => value[lang];

/** A new Localized with `fn` applied to the text of every language. */
export const mapLocalized = (value: Localized, fn: (text: string, lang: Lang) => string): Localized =>
  Object.fromEntries(LANGS.map((lang) => [lang, fn(value[lang], lang)])) as Localized;

export const htmlLang = (lang: Lang): string => LANG_META[lang].htmlLang;

/** Lowercases with the language's own casing rules (e.g. Turkish dotted I). */
export const lowerFor = (text: string, lang: Lang): string => text.toLocaleLowerCase(htmlLang(lang));
