import { z } from "zod";
import { SlugSchema, type Entry } from "../../scripts/extract/schemas";
import { WeaponEffectsSchema, type WeaponEffects } from "../../scripts/wiki/schema";
import rawOverrides from "../data/fixed-bonus-overrides.json";
import rawWeaponEffects from "../data/weapon-effects.json";
import { findBaseEntry, publishedEntries } from "./data";

/** Compatible and fixed weapon effects from the Minecraft Wiki (see scripts/wiki). */
export const weaponEffects: WeaponEffects = WeaponEffectsSchema.parse(rawWeaponEffects);

/**
 * Fixed bonuses the wiki does not name, checked in game. Keyed by weapon slug. "enchantment-book" points at a book
 * whose name, text and icon stand in for an enchantment that has no entry of its own.
 */
const FixedOverridesSchema = z.record(
  SlugSchema,
  z.object({
    kind: z.enum(["effect", "enchantment", "enchantment-book"]),
    slug: SlugSchema,
    /** The number the game fills into the text, e.g. "80%". */
    value: z.string().optional(),
    source: z.string(),
  }),
);
const fixedOverrides = FixedOverridesSchema.parse(rawOverrides);

export interface ResolvedWeaponEffects {
  /** Wiki page the data came from. */
  readonly page: string;
  readonly pageUrl: string;
  readonly compatible: readonly { readonly effect: Entry; readonly values: readonly [string, string, string] }[];
  readonly fixed?: {
    readonly kind: "effect" | "enchantment";
    readonly entry: Entry;
    readonly value?: string;
    /** Whether the entry has a page of its own to link to. */
    readonly linked: boolean;
  };
}

const PLACEHOLDER = /<span class="placeholder">\{[^}]*\}<\/span>/g;
const WIKI_ARTICLE = "https://minecraft.wiki/w/";

/** Game text with its single `{value}` placeholder replaced by `value`; text with none or several stays as it is. */
export function fillPlaceholder(html: string, value: string): string {
  const matches = html.match(PLACEHOLDER) ?? [];
  return matches.length === 1 ? html.replace(PLACEHOLDER, `<span class="value">${value}</span>`) : html;
}

/** Tier I to tier III as one range, e.g. "5%~15%"; a single value when the tiers do not differ. */
export const tierRange = ([low, , high]: readonly [string, string, string]): string => (low === high ? low : `${low}~${high}`);

/** The wiki's own URL form for a page title: spaces become underscores, everything else stays readable. */
export const wikiPageUrl = (title: string): string => `${WIKI_ARTICLE}${encodeURI(title.replace(/ /g, "_"))}`;

const bySlug = (category: Entry["category"], slug: string): Entry | undefined =>
  publishedEntries.find((entry) => entry.category === category && entry.slug === slug);

function fixedBonus(weapon: Entry, wiki: WeaponEffects["weapons"][string]): ResolvedWeaponEffects["fixed"] {
  if (wiki.fixed) {
    const entry = bySlug(wiki.fixed.kind, wiki.fixed.slug);
    return entry ? { kind: wiki.fixed.kind, entry, value: wiki.fixed.value, linked: true } : undefined;
  }
  const override = fixedOverrides[weapon.slug];
  if (!override) return undefined;
  if (override.kind === "enchantment-book") {
    const book = findBaseEntry("enchantment-book", override.slug);
    return book ? { kind: "enchantment", entry: book, value: override.value, linked: false } : undefined;
  }
  const entry = bySlug(override.kind, override.slug);
  return entry ? { kind: override.kind, entry, value: override.value, linked: true } : undefined;
}

/** A weapon's wiki effect data joined to the site's entries; undefined when the entry is not a weapon on the wiki. */
export function weaponEffectsOf(weapon: Entry): ResolvedWeaponEffects | undefined {
  const data = weaponEffects.weapons[weapon.slug];
  if (!data || (weapon.category !== "melee" && weapon.category !== "ranged")) return undefined;
  const compatible = data.compatible.flatMap(({ effect, values }) => {
    const entry = bySlug("effect", effect);
    return entry ? [{ effect: entry, values }] : [];
  });
  const fixed = fixedBonus(weapon, data);
  return { page: data.page, pageUrl: wikiPageUrl(data.page), compatible, ...(fixed ? { fixed } : {}) };
}

/** Published weapons that carry this effect or enchantment as their fixed, non-rerollable bonus. */
export function fixedOn(entry: Entry): Entry[] {
  return publishedEntries.filter((weapon) => {
    const fixed = weaponEffectsOf(weapon)?.fixed;
    return fixed?.linked === true && fixed.entry.category === entry.category && fixed.entry.slug === entry.slug;
  });
}
