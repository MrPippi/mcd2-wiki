import type { Lang } from "../../scripts/extract/langs";
import rawGameStrings from "../data/ui-game-strings.json";
import zh from "../i18n/zh.json";
import { z } from "zod";
import { LANG_META } from "../../scripts/extract/langs";
import { UI_DICTS, fileValue, plainText, type UiValue } from "./ui-dicts";

export type UiKey = Exclude<keyof typeof zh, "_machine">;

const GameStringsSchema = z.record(z.string(), z.object({ zh: z.string(), en: z.string() }));
/** Official UI wording read from the game's localization files by `npm run extract`, by site key. */
const GAME_STRINGS = GameStringsSchema.parse(rawGameStrings);

const gameValue = (lang: Lang, key: string): string | undefined => GAME_STRINGS[key]?.[lang] || undefined;
/** Traditional Chinese and English are written by hand, so the file wins; other languages take the game's own wording first. */
const HAND_WRITTEN: readonly Lang[] = ["zh", "en"];

export interface UiCandidates {
  /** The language file's value. */
  readonly own?: UiValue;
  /** The game's own wording. */
  readonly game?: string;
  /** The English file's value, the fallback for a missing key. */
  readonly english?: UiValue;
}

/** Picks the text: hand-written languages prefer their file, the others the game; then English, then the key itself. Never throws. */
export function resolveUiValue(key: string, handWritten: boolean, { own, game, english }: UiCandidates): UiValue {
  const found = handWritten ? (own ?? game) : (game ?? own);
  return found ?? english ?? key;
}

const lookup = (lang: Lang, key: UiKey): UiValue =>
  resolveUiValue(key, HAND_WRITTEN.includes(lang), { own: fileValue(lang, key), game: gameValue(lang, key), english: fileValue("en", key) });

/** The text for a key; for a unit with plural forms, the general form. */
export const t = (lang: Lang, key: UiKey): string => plainText(lookup(lang, key));

function pluralForm(lang: Lang, value: UiValue, count: number): string {
  if (typeof value === "string") return value;
  const category = new Intl.PluralRules(LANG_META[lang].htmlLang).select(count);
  switch (category) {
    case "one":
      return value.one ?? value.other;
    case "few":
      return value.few ?? value.other;
    case "many":
      return value.many ?? value.other;
    default:
      return value.other;
  }
}

/** The text for a unit key with `{n}` replaced by the count, in the plural form the language picks for it. */
export function tCount(lang: Lang, key: UiKey, count: number): string {
  const value = lookup(lang, key);
  return pluralForm(lang, value, count).replaceAll("{n}", String(count));
}

/** Keys of a language file that are machine translated. */
export const machineKeys = (lang: Lang): readonly UiKey[] => UI_DICTS[lang].machine.filter((key): key is UiKey => key in zh);
