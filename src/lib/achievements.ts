import { AchievementDataSchema, type Achievement, type AchievementData } from "../../scripts/extract/achievement-schema";
import rawAchievements from "../data/achievements.json";
import { htmlLang, type Lang } from "./lang";

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
