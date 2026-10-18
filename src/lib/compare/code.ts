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

/** The picks after `slug` is added at the end: unchanged when it is already compared or the comparison is full. */
export const addWeapon = (slugs: readonly string[], slug: string): readonly string[] =>
  slugs.includes(slug) || slugs.length >= MAX_WEAPONS ? slugs : [...slugs, slug];

/** The picks after the weapon in `column` is removed: later columns move left. */
export const removeWeapon = (slugs: readonly string[], column: number): string[] => slugs.filter((_, index) => index !== column);
