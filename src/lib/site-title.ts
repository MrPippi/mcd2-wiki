/** The game's name; on the home page it gets a line of its own. */
export const GAME_NAME = "Minecraft Dungeons II";

export interface SiteTitleParts {
  readonly game: string;
  /** What follows the game name, e.g. "Wiki" or "中文 Wiki". */
  readonly word: string;
  /** A trailing qualifier in half- or full-width parentheses, e.g. "(zh-TW)" or "（简体）". */
  readonly tag?: string;
}

const QUALIFIER = /^(.*?)\s*(\(.+\)|（.+）)$/u;

/** Splits a site title into the game name, the rest, and a trailing qualifier; undefined when it does not start with the game name. */
export function splitSiteTitle(title: string): SiteTitleParts | undefined {
  if (!title.startsWith(GAME_NAME)) return undefined;
  const rest = title.slice(GAME_NAME.length).trim();
  if (rest === "") return undefined;
  const match = rest.match(QUALIFIER);
  return { game: GAME_NAME, word: match?.[1] ?? rest, tag: match?.[2] };
}
