/** The compared weapons in the page URL: `?w=sword,axe,bow`. No imports: the browser script loads it. */

export const MAX_WEAPONS = 3;
const PARAM = "w";
const SEPARATOR = ",";

export interface DecodedCompare {
  /** Up to MAX_WEAPONS known, distinct slugs in link order. */
  readonly slugs: readonly string[];
  /** Slugs left out: unknown, repeated or past the last column. */
  readonly dropped: number;
}

/** Reads the compared weapons from `location.search`, keeping known slugs only. */
export function decodeCompare(search: string, known: ReadonlySet<string>): DecodedCompare {
  const values = (new URLSearchParams(search).get(PARAM) ?? "").split(SEPARATOR).filter((slug) => slug !== "");
  const slugs = values.reduce<string[]>((kept, slug) => (known.has(slug) && !kept.includes(slug) && kept.length < MAX_WEAPONS ? [...kept, slug] : kept), []);
  return { slugs, dropped: values.length - slugs.length };
}

/** `search` with the compared weapons replaced, other parameters kept: "?…", or empty. Commas stay readable. */
export function compareSearch(search: string, slugs: readonly string[]): string {
  const others = new URLSearchParams(search);
  others.delete(PARAM);
  const own = slugs.length > 0 ? `${PARAM}=${slugs.map(encodeURIComponent).join(SEPARATOR)}` : "";
  const query = [others.toString(), own].filter(Boolean).join("&");
  return query ? `?${query}` : "";
}

/** The column to highlight per row: the indexes holding the best value, none when fewer than two values compare. */
export function bestColumns(values: readonly (number | undefined)[], better: "high" | "low" | "none"): number[] {
  const present = values.flatMap((value, index) => (value === undefined ? [] : [{ value, index }]));
  if (better === "none" || present.length < 2) return [];
  const target = better === "high" ? Math.max(...present.map((cell) => cell.value)) : Math.min(...present.map((cell) => cell.value));
  const best = present.filter((cell) => cell.value === target).map((cell) => cell.index);
  return best.length === present.length ? [] : best;
}

/** The picks after `slug` goes into `column`: packed to the left, a weapon already in an earlier column kept there. */
export function placeWeapon(slugs: readonly string[], column: number, slug: string): string[] {
  const next = column < slugs.length ? slugs.map((current, index) => (index === column ? slug : current)) : [...slugs, slug];
  return next.filter((current, index) => next.indexOf(current) === index).slice(0, MAX_WEAPONS);
}

/** The picks after `column` is emptied: later columns move left. */
export const removeWeapon = (slugs: readonly string[], column: number): string[] => slugs.filter((_, index) => index !== column);
