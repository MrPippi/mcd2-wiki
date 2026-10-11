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

const COMBINING_DOT_ABOVE = new RegExp(String.fromCodePoint(0x0307), "g");
const DOTLESS_I = new RegExp(String.fromCodePoint(0x0131), "g");

/**
 * Search key for text in the language whose html lang tag is `locale`: lowercased by that language's rules,
 * then with Turkish dotted and dotless I folded to a plain "i" so İ/I/ı/i all meet. Dependency-free for browser scripts.
 */
export const foldForSearch = (text: string, locale: string): string =>
  text.toLocaleLowerCase(locale).replace(COMBINING_DOT_ABOVE, "").replace(DOTLESS_I, "i");

/** foldForSearch for a site language. Haystacks and queries must both go through this fold. */
export const searchFold = (text: string, lang: Lang): string => foldForSearch(text, htmlLang(lang));

/** The searchable names of an entry on a `lang` page: its own name and its comparison-language name, each folded by its own language. */
export const searchNames = (name: Localized, lang: Lang): string =>
  [lang, compareLang(lang)].map((l) => searchFold(name[l], l)).join(" ");

/** Accessible name of the language menu button: it contains the visible native name and the code shown on narrow screens (WCAG 2.5.3). */
export const langMenuLabel = (lang: Lang, menuWord: string): string =>
  `${menuWord}: ${LANG_META[lang].nativeName} (${lang.toUpperCase()})`;
