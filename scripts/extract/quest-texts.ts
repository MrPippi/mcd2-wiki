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

/** The game's text in every language; a language with no text (or "ERROR") shows English. Undefined without usable English. */
export function questText(locales: Locales, namespace: string, key: string): QuestText | undefined {
  const texts = gameTexts(locales, namespace, key);
  const english = texts?.en;
  if (!usable(english)) return undefined;
  const own = (lang: Lang): string | undefined => (usable(texts?.[lang]) ? texts?.[lang] : undefined);
  return {
    text: localizedFrom((lang) => own(lang) ?? english),
    untranslated: LANGS.filter((lang) => own(lang) === undefined),
  };
}

/** Like questText, with the game's markup (<emphasis>…</>) rendered to HTML. */
export function questHtml(locales: Locales, namespace: string, key: string): QuestHtml | undefined {
  const found = questText(locales, namespace, key);
  if (!found) return undefined;
  return { html: localizedFrom((lang) => renderMarkup(found.text[lang], lang).html), untranslated: found.untranslated };
}

/** Whether the quest labels hold a usable English text for this key (a quest title or a task label). */
export const hasLabel = (locales: Locales, key: string): boolean => usable(locales.en[QUEST_LABELS]?.[key]);
