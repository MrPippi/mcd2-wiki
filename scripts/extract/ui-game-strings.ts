import type { Lang } from "../../shared/config";
import { issue, type Issue } from "./issues";
import { gameTexts } from "./loc-table";
import type { LocaleFile } from "../../shared/schemas";

/** Where the game keeps the text for a site UI key. */
export interface UiGameKey {
  readonly namespace: string;
  readonly key: string;
}

export interface UiGameStrings {
  /** Only the languages the game really has: a missing one falls through to the site's language file. */
  readonly strings: Readonly<Record<string, Partial<Record<Lang, string>>>>;
  readonly issues: Issue[];
}

/** The game's text for each site key in the languages it has; keys the game does not have are left out and reported. */
export function buildUiGameStrings(locales: Readonly<Record<Lang, LocaleFile>>, keys: Readonly<Record<string, UiGameKey>>): UiGameStrings {
  const found = Object.entries(keys).map(([siteKey, ref]) => ({ siteKey, ref, text: gameTexts(locales, ref.namespace, ref.key) }));
  return {
    strings: Object.fromEntries(found.flatMap(({ siteKey, text }) => (text ? [[siteKey, text]] : []))),
    issues: found.filter(({ text }) => !text).map(({ siteKey, ref }) => issue("missing-ui-game-string", `${siteKey}: ${ref.namespace} ${ref.key}`)),
  };
}
