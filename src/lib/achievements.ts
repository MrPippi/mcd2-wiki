import {
  AchievementDataSchema,
  type Achievement,
  type AchievementCondition,
  type AchievementData,
} from "../../shared/achievement-schema";
import rawAchievements from "../data/achievements.json";
import { htmlLang, type Lang } from "../../shared/lang";
import { t, type UiKey } from "./ui-strings";

/** Steam achievements from `npm run extract`, validated at build time. */
export const achievementData: AchievementData = AchievementDataSchema.parse(rawAchievements);

/** A new list, highest global unlock rate first; ties keep Steam id order. */
export const achievementsByRate = (list: readonly Achievement[]): Achievement[] =>
  [...list].sort((a, b) => b.globalPercent - a.globalPercent || a.id.localeCompare(b.id, "en"));

/** A 0–100 rate as a percentage with one decimal, written the way the language writes it (91.9%, 91,9 %, %91,9). */
export const formatPercent = (value: number, lang: Lang): string =>
  new Intl.NumberFormat(htmlLang(lang), { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 100);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** An ISO date (YYYY-MM-DD) in the language's medium date style; anything else is returned as it is. */
export function formatRetrieved(date: string, lang: Lang): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!ISO_DATE.test(date) || Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(htmlLang(lang), { dateStyle: "medium", timeZone: "UTC" }).format(parsed);
}

const CONDITION_KEY: Readonly<Record<AchievementCondition["type"], UiKey>> = {
  quest: "conditionQuest",
  task: "conditionTask",
  boss: "conditionBoss",
};

/** What unlocks a hidden achievement, as a sentence in `lang` (完成任務「逃離烏賊海岸」). */
export const conditionSentence = (condition: AchievementCondition, lang: Lang): string =>
  t(lang, CONDITION_KEY[condition.type]).replace("{name}", condition.name[lang]);

export interface UntranslatedMarkers {
  /** Every achievement shows English in this language: one marker in the page head says so. */
  readonly page: boolean;
  /** Otherwise, the ids of the few achievements that show English, each marked on its card. */
  readonly cards: ReadonlySet<string>;
}

/** Where the page marks English stand-in text: once in the head when it is all English, else on each card that is. */
export function untranslatedMarkers(list: readonly Achievement[], lang: Lang): UntranslatedMarkers {
  const fellBack = list.filter((item) => item.untranslated?.includes(lang)).map((item) => item.id);
  const page = list.length > 0 && fellBack.length === list.length;
  return { page, cards: new Set(page ? [] : fellBack) };
}

/** The id of an achievement's card heading, which search results link to. */
export const achievementAnchor = (slug: string): string => `ach-${slug}`;
