/** The one place a game text becomes a per-language record: English fills every language that has no usable text of its own, and those languages are listed. */
import { localizedFrom } from "../../shared/lang";
import type { Lang } from "../../shared/config";
import { LANGS } from "../../shared/langs";
import { gameTexts } from "./loc-table";
import { renderMarkup } from "../../shared/render-markup";
import type { LocaleFile, Localized } from "../../shared/schemas";

type Locales = Readonly<Record<Lang, LocaleFile>>;

export interface GameText {
  readonly text: Localized;
  /** Languages that show the English text. */
  readonly untranslated: Lang[];
}

export interface GameHtml {
  readonly html: Localized;
  readonly untranslated: Lang[];
}

/** The text a language may publish for what the game has (undefined: none, so it shows English). */
export type Accept = (lang: Lang, text: string | undefined) => string | undefined;

const asIs: Accept = (_lang, text) => text;

/** Text in every language; no usable English means no text. Other languages without a usable text take the English and are listed. */
export function resolveTexts(texts: Partial<Record<Lang, string>> | undefined, accept: Accept = asIs): GameText | undefined {
  const english = accept("en", texts?.en);
  if (english === undefined) return undefined;
  const own = (lang: Lang): string | undefined => (lang === "en" ? english : accept(lang, texts?.[lang]));
  return {
    text: localizedFrom((lang) => own(lang) ?? english),
    untranslated: LANGS.filter((lang) => own(lang) === undefined),
  };
}

/** One game text in every language; undefined without usable English. */
export function gameText(locales: Locales, namespace: string, key: string, accept?: Accept): GameText | undefined {
  return resolveTexts(gameTexts(locales, namespace, key), accept);
}

/** Like gameText, with the game's markup (<emphasis>…</>) rendered to HTML. */
export function gameHtml(locales: Locales, namespace: string, key: string, accept?: Accept): GameHtml | undefined {
  const found = gameText(locales, namespace, key, accept);
  if (!found) return undefined;
  return { html: localizedFrom((lang) => renderMarkup(found.text[lang], lang).html), untranslated: found.untranslated };
}

/** Text in every language; a missing language falls back to English, and no English means no text. */
export const localize = (locales: Locales, namespace: string, key: string): Localized | undefined => gameText(locales, namespace, key)?.text;
