import type { Lang } from "../../scripts/extract/config";
import type { LocaleFile } from "../../scripts/extract/schemas";
import { byLang } from "../../src/lib/lang";

export const ns = (table: string): string => `Text/Release/${table}.csv`;

/** Texts by namespace, then key, then language; a language left out takes the English text. */
type Rows = Record<string, Record<string, Partial<Record<Lang, string>> & { en: string }>>;

export function makeLocales(rows: Rows): Record<Lang, LocaleFile> {
  const fileFor = (lang: Lang): LocaleFile =>
    Object.fromEntries(
      Object.entries(rows).map(([namespace, keys]) => [
        namespace,
        Object.fromEntries(Object.entries(keys).map(([key, texts]) => [key, texts[lang] ?? texts.en])),
      ]),
    );
  return byLang(fileFor);
}

type SparseRows = Record<string, Record<string, Partial<Record<Lang, string>>>>;

/** Like makeLocales, but a language left out has no text at all (so englishFallbacks can see it). */
export function makeSparseLocales(rows: SparseRows): Record<Lang, LocaleFile> {
  const fileFor = (lang: Lang): LocaleFile =>
    Object.fromEntries(Object.entries(rows).map(([namespace, keys]) => [
      namespace,
      Object.fromEntries(Object.entries(keys).flatMap(([key, texts]) => { const text = texts[lang]; return text === undefined ? [] : [[key, text]]; })),
    ]));
  return byLang(fileFor);
}
