import { LANG_META, type Lang } from "../../scripts/extract/langs";
import type { Localized } from "../../scripts/extract/schemas";

export type { Lang };

/** The language shown beside a page's own language in compare mode: English pairs with Traditional Chinese, everything else with English. */
export const compareLang = (lang: Lang): Lang => (lang === "en" ? "zh" : "en");

export const pick = (value: Localized, lang: Lang): string => value[lang];

/** A record with the value `fn` gives for each language (written out so a new language is a compile error until handled). */
export const byLang = <T,>(fn: (lang: Lang) => T): Record<Lang, T> => ({
  zh: fn("zh"),
  "zh-hans": fn("zh-hans"),
  en: fn("en"),
  ja: fn("ja"),
  ko: fn("ko"),
  de: fn("de"),
  fr: fn("fr"),
  es: fn("es"),
  it: fn("it"),
  pt: fn("pt"),
  ru: fn("ru"),
  pl: fn("pl"),
  nl: fn("nl"),
  sv: fn("sv"),
  tr: fn("tr"),
  uk: fn("uk"),
});

/** A Localized with the text `fn` gives for each language. */
export const localizedFrom = (fn: (lang: Lang) => string): Localized => byLang(fn);

/** A new Localized with `fn` applied to the text of every language. */
export const mapLocalized = (value: Localized, fn: (text: string, lang: Lang) => string): Localized =>
  localizedFrom((lang) => fn(value[lang], lang));

export const htmlLang = (lang: Lang): string => LANG_META[lang].htmlLang;

/** Lowercases with the language's own casing rules (e.g. Turkish dotted I). */
export const lowerFor = (text: string, lang: Lang): string => text.toLocaleLowerCase(htmlLang(lang));
