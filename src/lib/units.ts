import type { Lang } from "./i18n";
import { tCount } from "./ui-strings";

/** Rounds to `digits` decimals. */
export const round = (value: number, digits = 2): number => Math.round(value * 10 ** digits) / 10 ** digits;

/** A rounded number as text, e.g. "1.5". */
export const roundText = (value: number, digits = 2): string => String(round(value, digits));

/** A duration with its unit, e.g. "1.5 sec". */
export const secondsText = (lang: Lang, value: number): string => tCount(lang, "unitSeconds", round(value));

/** A distance with its unit in the language's plural form, e.g. "1 block", "3 blocks". */
export const blocksText = (lang: Lang, value: number): string => tCount(lang, "unitBlocks", round(value));
