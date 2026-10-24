/** The site changelog: hand-written entries in src/changelog.json, newest first. Server-side only. */
import { z } from "zod";
import type { Lang } from "../../shared/lang";
import { htmlLang } from "../../shared/lang";
import rawEntries from "../changelog.json";
import type { UiKey } from "./ui-strings";

export const CHANGE_KINDS = ["new", "improved", "fixed"] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];

const ChangeSchema = z.object({
  kind: z.enum(CHANGE_KINDS),
  /** Path under the language, e.g. "guides/threat"; the change links to that page. */
  link: z.string().regex(/^[a-z0-9-]+(\/[a-z0-9-]+)*$/).optional(),
  zh: z.string().min(1),
  en: z.string().min(1),
});
export type Change = z.infer<typeof ChangeSchema>;

const EntrySchema = z.object({
  date: z.iso.date(),
  changes: z.array(ChangeSchema).min(1),
});
export type ChangelogEntry = z.infer<typeof EntrySchema>;

/** Entries must be newest first, one per date, so the page and the latest-update date need no sorting. */
export const ChangelogSchema = z
  .array(EntrySchema)
  .min(1)
  .refine((entries) => entries.every((entry, i) => i === 0 || entry.date < (entries[i - 1]?.date ?? "")), "entries must be newest first, one per date");

export const changelog: readonly ChangelogEntry[] = ChangelogSchema.parse(rawEntries);

export const CHANGE_KIND_KEY: Readonly<Record<ChangeKind, UiKey>> = {
  new: "changelogNew",
  improved: "changelogImproved",
  fixed: "changelogFixed",
};

/**
 * A change's text in `lang`. Only Traditional Chinese and English are written; every other language shows the
 * English text (the site's fallback for text without a checked translation), marked with its language.
 */
export function changeText(change: Change, lang: Lang): { text: string; lang: Lang } {
  if (lang === "zh") return { text: change.zh, lang: "zh" };
  return { text: change.en, lang: "en" };
}

/** An entry's date in `lang`'s long form; the date is a calendar day, so it is formatted in UTC. */
export const changelogDate = (date: string, lang: Lang): string =>
  new Intl.DateTimeFormat(htmlLang(lang), { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
