import type { Lang } from "../../shared/langs";
import rawGameStrings from "../data/ui-game-strings.json";
import zh from "../../shared/i18n/zh.json";
import { z } from "zod";
import { LANGS, LANG_META } from "../../shared/langs";
import { UI_DICTS, fileValue, plainText, type UiKey, type UiValue } from "../../shared/ui-dicts";

export type { UiKey };

const GameStringsSchema = z.record(z.string(), z.partialRecord(z.enum(LANGS), z.string()));
type GameStrings = z.infer<typeof GameStringsSchema>;
/** Official UI wording read from the game's localization files by `npm run extract`, by site key. */
const GAME_STRINGS = GameStringsSchema.parse(rawGameStrings);

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

/** The value for a key given the game's strings (exported for tests; a language the game lacks falls through to its file). */
export const lookupWith = (game: GameStrings, lang: Lang, key: UiKey): UiValue =>
  resolveUiValue(key, HAND_WRITTEN.includes(lang), { own: fileValue(lang, key), game: game[key]?.[lang] || undefined, english: fileValue("en", key) });

const lookup = (lang: Lang, key: UiKey): UiValue => lookupWith(GAME_STRINGS, lang, key);

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
