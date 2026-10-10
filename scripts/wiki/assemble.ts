import type { Category } from "../extract/config";
import type { Entry } from "../extract/schemas";
import { parseCompatibleEffects, parseFixedBonus, wikiSection } from "./parse";
import type { WeaponEffectData, WeaponEffects } from "./schema";

export interface WikiPage {
  readonly title: string;
  readonly revision: number;
  readonly text: string;
}

export interface WeaponEffectsReport {
  /** Weapons whose wiki page does not exist. */
  readonly missingPages: readonly string[];
  /** Weapons whose page has no "Compatible effects" rows yet. */
  readonly noCompatible: readonly string[];
  /** Unique weapons whose page does not name a fixed bonus. */
  readonly noFixedBonus: readonly string[];
  /** Effect or enchantment names that match no entry, or more than one. */
  readonly unmatched: readonly string[];
}

const WEAPON_CATEGORIES: readonly Category[] = ["melee", "ranged"];
const SOURCE: WeaponEffects["source"] = {
  site: "Minecraft Wiki",
  url: "https://minecraft.wiki/",
  license: "CC BY-NC-SA 3.0",
  licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/3.0/",
};

/** Wiki page title for a weapon: the Dungeons II namespace plus its English name. */
export const wikiTitle = (weapon: Entry): string => `Dungeons II:${weapon.name.en}`;

export const isWeapon = (entry: Entry): boolean => WEAPON_CATEGORIES.includes(entry.category);

type Lookup = (category: "effect" | "enchantment", name: string) => { slug?: string; problem?: string };

function lookupIn(entries: readonly Entry[]): Lookup {
  return (category, name) => {
    const matches = entries.filter((entry) => entry.category === category && entry.name.en.toLowerCase() === name.toLowerCase());
    if (matches.length === 1) return { slug: matches[0].slug };
    return { problem: `${category} ${name}${matches.length > 1 ? ` (${matches.length} matches)` : ""}` };
  };
}

interface Assembled {
  readonly data: WeaponEffectData;
  readonly problems: readonly string[];
}

function weaponData(weapon: Entry, page: WikiPage, lookup: Lookup): Assembled {
  const label = weapon.name.en;
  const rows = parseCompatibleEffects(wikiSection(page.text, "Compatible effects") ?? "").map((row) => ({ row, match: lookup("effect", row.name) }));
  const compatible = rows.flatMap(({ row, match }) =>
    match.slug ? [{ effect: match.slug, values: [...row.values] as [string, string, string] }] : [],
  );
  const bonus = weapon.variant === "unique" ? parseFixedBonus(wikiSection(page.text, "Unique effect") ?? "") : undefined;
  const bonusMatch = bonus ? lookup(bonus.kind, bonus.name) : undefined;
  const fixed =
    bonus && bonusMatch?.slug ? { kind: bonus.kind, slug: bonusMatch.slug, ...(bonus.value ? { value: bonus.value } : {}) } : undefined;
  const problems = [...rows.map(({ match }) => match.problem), bonusMatch?.problem]
    .filter((problem): problem is string => problem !== undefined)
    .map((problem) => `${label}: ${problem}`);
  return { data: { page: page.title, revision: page.revision, compatible, ...(fixed ? { fixed } : {}) }, problems };
}

/** Joins wiki pages to the site's weapons, effects and enchantments; names that do not match are reported, not guessed. */
export function assembleWeaponEffects(
  entries: readonly Entry[],
  pages: ReadonlyMap<string, WikiPage>,
): { data: WeaponEffects; report: WeaponEffectsReport } {
  const lookup = lookupIn(entries);
  const found = entries.filter(isWeapon).map((weapon) => ({ weapon, page: pages.get(wikiTitle(weapon)) }));
  const assembled = found.flatMap(({ weapon, page }) => (page ? [{ weapon, ...weaponData(weapon, page, lookup) }] : []));
  const weapons: Record<string, WeaponEffectData> = Object.fromEntries(assembled.map(({ weapon, data }) => [weapon.slug, data]));
  const missingPages = found.filter(({ page }) => !page).map(({ weapon }) => weapon.name.en);
  const unmatched = assembled.flatMap(({ problems }) => problems);
  const named = (slug: string) => entries.find((entry) => entry.slug === slug)?.name.en ?? slug;
  const slugs = Object.keys(weapons);
  return {
    data: { source: SOURCE, weapons },
    report: {
      missingPages,
      noCompatible: slugs.filter((slug) => weapons[slug].compatible.length === 0).map(named),
      noFixedBonus: slugs
        .filter((slug) => entries.find((entry) => entry.slug === slug)?.variant === "unique" && !weapons[slug].fixed)
        .map(named),
      unmatched,
    },
  };
}
