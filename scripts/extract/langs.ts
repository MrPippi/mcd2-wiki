// Language registry. No imports: the browser bundle reads it too, so keep Node modules out.
/** Every language the site will offer, in language-menu order (the URL code is the first path segment). */
export const ALL_LANGS = ["zh", "zh-hans", "en", "ja", "ko", "de", "fr", "es", "it", "pt", "ru", "pl", "nl", "sv", "tr", "uk"] as const;
export type AnyLang = (typeof ALL_LANGS)[number];
export type FontScript = "tc" | "sc" | "jp" | "kr" | "latin" | "cyrillic";
export interface LangMeta {
  readonly culture: string;
  readonly htmlLang: string;
  readonly ogLocale: string;
  readonly nativeName: string;
  readonly fontScript: FontScript;
}
export const LANG_META: Readonly<Record<AnyLang, LangMeta>> = {
  zh: { culture: "zh-Hant", htmlLang: "zh-TW", ogLocale: "zh_TW", nativeName: "繁體中文", fontScript: "tc" },
  "zh-hans": { culture: "zh-Hans", htmlLang: "zh-CN", ogLocale: "zh_CN", nativeName: "简体中文", fontScript: "sc" },
  en: { culture: "en", htmlLang: "en", ogLocale: "en_US", nativeName: "English", fontScript: "latin" },
  ja: { culture: "ja-JP", htmlLang: "ja", ogLocale: "ja_JP", nativeName: "日本語", fontScript: "jp" },
  ko: { culture: "ko-KR", htmlLang: "ko", ogLocale: "ko_KR", nativeName: "한국어", fontScript: "kr" },
  de: { culture: "de-DE", htmlLang: "de", ogLocale: "de_DE", nativeName: "Deutsch", fontScript: "latin" },
  fr: { culture: "fr-FR", htmlLang: "fr", ogLocale: "fr_FR", nativeName: "Français", fontScript: "latin" },
  es: { culture: "es-ES", htmlLang: "es", ogLocale: "es_ES", nativeName: "Español", fontScript: "latin" },
  it: { culture: "it-IT", htmlLang: "it", ogLocale: "it_IT", nativeName: "Italiano", fontScript: "latin" },
  pt: { culture: "pt-BR", htmlLang: "pt-BR", ogLocale: "pt_BR", nativeName: "Português (Brasil)", fontScript: "latin" },
  ru: { culture: "ru-RU", htmlLang: "ru", ogLocale: "ru_RU", nativeName: "Русский", fontScript: "cyrillic" },
  pl: { culture: "pl-PL", htmlLang: "pl", ogLocale: "pl_PL", nativeName: "Polski", fontScript: "latin" },
  nl: { culture: "nl-NL", htmlLang: "nl", ogLocale: "nl_NL", nativeName: "Nederlands", fontScript: "latin" },
  sv: { culture: "sv-SE", htmlLang: "sv", ogLocale: "sv_SE", nativeName: "Svenska", fontScript: "latin" },
  tr: { culture: "tr-TR", htmlLang: "tr", ogLocale: "tr_TR", nativeName: "Türkçe", fontScript: "latin" },
  uk: { culture: "uk-UA", htmlLang: "uk", ogLocale: "uk_UA", nativeName: "Українська", fontScript: "cyrillic" },
};

/** Languages the pipeline and site handle. */
export const LANGS = ALL_LANGS;
export type Lang = AnyLang;

