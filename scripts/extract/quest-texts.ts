/** The game's quest texts: titles and objective labels (QuestTrackerLabels), descriptions and completed texts (markup rendered). */
import { localizedFrom } from "../../src/lib/lang";
import type { Lang } from "./config";
import { LANGS } from "./langs";
import { gameTexts } from "./loc-table";
import { renderMarkup } from "./render-markup";
import type { LocaleFile, Localized } from "./schemas";

type Locales = Readonly<Record<Lang, LocaleFile>>;

export const QUEST_LABELS = "Text/Release/QuestTrackerLabels.csv";
export const QUEST_DESCRIPTIONS = "Text/Release/QuestDescriptions.csv";
export const QUEST_COMPLETED = "Text/Release/QuestDescriptionsCompleted.csv";
/** The game's placeholder for a text nobody wrote: never published. */
const BROKEN = "ERROR";

export interface QuestText {
  readonly text: Localized;
  /** Languages that show the English text. */
  readonly untranslated: Lang[];
}

export interface QuestHtml {
  readonly html: Localized;
  readonly untranslated: Lang[];
}

const usable = (text: string | undefined): text is string => text !== undefined && text.trim() !== "" && text.trim() !== BROKEN;

/** A text a language must not publish for this key (a known language problem); it shows English instead. */
export type Reject = (lang: Lang, text: string) => boolean;

/**
 * The game's text in every language; a language with no text, "ERROR", or a rejected text shows English and is listed
 * as untranslated. Undefined without usable English.
 */
export function questText(locales: Locales, namespace: string, key: string, reject: Reject = () => false): QuestText | undefined {
  const texts = gameTexts(locales, namespace, key);
  const english = texts?.en;
  if (!usable(english)) return undefined;
  const own = (lang: Lang): string | undefined => {
    const text = texts?.[lang];
    return usable(text) && (lang === "en" || !reject(lang, text)) ? text : undefined;
  };
  return {
    text: localizedFrom((lang) => own(lang) ?? english),
    untranslated: LANGS.filter((lang) => own(lang) === undefined),
  };
}

/** Like questText, with the game's markup (<emphasis>…</>) rendered to HTML. */
export function questHtml(locales: Locales, namespace: string, key: string, reject?: Reject): QuestHtml | undefined {
  const found = questText(locales, namespace, key, reject);
  if (!found) return undefined;
  return { html: localizedFrom((lang) => renderMarkup(found.text[lang], lang).html), untranslated: found.untranslated };
}

/** Texts compared as the player reads them: markup spacing and line breaks do not count. */
const squeeze = (text: string | undefined): string => (text ?? "").replace(/\s+/g, "");

/**
 * A language whose description is its own completed text, while English keeps the two apart, ships the wrong text
 * (zh PLa1_S04_A: the briefing already tells how the quest ends). Such a description shows English.
 */
export const descriptionIsCompletedText =
  (locales: Locales, key: string): Reject =>
  (lang, text) => {
    const completed = (one: Lang): string | undefined => locales[one][QUEST_COMPLETED]?.[key];
    const englishApart = squeeze(locales.en[QUEST_DESCRIPTIONS]?.[key]) !== squeeze(completed("en"));
    return englishApart && completed(lang) !== undefined && squeeze(text) === squeeze(completed(lang));
  };

/** Whether the quest labels hold a usable English text for this key (a quest title or a task label). */
export const hasLabel = (locales: Locales, key: string): boolean => usable(locales.en[QUEST_LABELS]?.[key]);
