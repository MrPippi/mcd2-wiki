/** The game's quest texts: titles and objective labels (QuestTrackerLabels), descriptions and completed texts (markup rendered). */
import type { Lang } from "./config";
import { gameHtml, gameText, type Accept, type GameHtml, type GameText } from "./game-text";
import type { LocaleFile } from "./schemas";

type Locales = Readonly<Record<Lang, LocaleFile>>;

export const QUEST_LABELS = "Text/Release/QuestTrackerLabels.csv";
export const QUEST_DESCRIPTIONS = "Text/Release/QuestDescriptions.csv";
export const QUEST_COMPLETED = "Text/Release/QuestDescriptionsCompleted.csv";
/** The game's placeholder for a text nobody wrote: never published. */
const BROKEN = "ERROR";

export type QuestText = GameText;
export type QuestHtml = GameHtml;

const usable = (text: string | undefined): text is string => text !== undefined && text.trim() !== "" && text.trim() !== BROKEN;

/** A text a language must not publish for this key (a known language problem); it shows English instead. */
export type Reject = (lang: Lang, text: string) => boolean;

const acceptUsable = (reject: Reject = () => false): Accept => (lang, text) => (usable(text) && (lang === "en" || !reject(lang, text)) ? text : undefined);

/**
 * The game's text in every language; a language with no text, "ERROR", or a rejected text shows English and is listed
 * as untranslated. Undefined without usable English.
 */
export function questText(locales: Locales, namespace: string, key: string, reject?: Reject): QuestText | undefined {
  return gameText(locales, namespace, key, acceptUsable(reject));
}

/** Like questText, with the game's markup (<emphasis>…</>) rendered to HTML. */
export function questHtml(locales: Locales, namespace: string, key: string, reject?: Reject): QuestHtml | undefined {
  return gameHtml(locales, namespace, key, acceptUsable(reject));
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
