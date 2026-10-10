import type { Entry } from "../../scripts/extract/schemas";
import { WeaponEffectsSchema, type WeaponEffects } from "../../scripts/wiki/schema";
import rawWeaponEffects from "../data/weapon-effects.json";
import { publishedEntries } from "./data";

/** Compatible and fixed weapon effects from the Minecraft Wiki (see scripts/wiki). */
export const weaponEffects: WeaponEffects = WeaponEffectsSchema.parse(rawWeaponEffects);

export interface ResolvedWeaponEffects {
  /** Wiki page the data came from. */
  readonly page: string;
  readonly pageUrl: string;
  readonly compatible: readonly { readonly effect: Entry; readonly values: readonly [string, string, string] }[];
  readonly fixed?: { readonly kind: "effect" | "enchantment"; readonly entry: Entry; readonly value?: string };
}

const PLACEHOLDER = /<span class="placeholder">\{[^}]*\}<\/span>/g;
const WIKI_ARTICLE = "https://minecraft.wiki/w/";

/** Game text with its single `{value}` placeholder replaced by `value`; text with none or several stays as it is. */
export function fillPlaceholder(html: string, value: string): string {
  const matches = html.match(PLACEHOLDER) ?? [];
  return matches.length === 1 ? html.replace(PLACEHOLDER, `<span class="value">${value}</span>`) : html;
}

/** The wiki's own URL form for a page title: spaces become underscores, everything else stays readable. */
export const wikiPageUrl = (title: string): string => `${WIKI_ARTICLE}${encodeURI(title.replace(/ /g, "_"))}`;

const bySlug = (category: Entry["category"], slug: string): Entry | undefined =>
  publishedEntries.find((entry) => entry.category === category && entry.slug === slug);

/** A weapon's wiki effect data joined to the site's entries; undefined when the entry is not a weapon on the wiki. */
export function weaponEffectsOf(weapon: Entry): ResolvedWeaponEffects | undefined {
  const data = weaponEffects.weapons[weapon.slug];
  if (!data || (weapon.category !== "melee" && weapon.category !== "ranged")) return undefined;
  const compatible = data.compatible.flatMap(({ effect, values }) => {
    const entry = bySlug("effect", effect);
    return entry ? [{ effect: entry, values }] : [];
  });
  const fixedEntry = data.fixed ? bySlug(data.fixed.kind, data.fixed.slug) : undefined;
  const fixed = data.fixed && fixedEntry ? { kind: data.fixed.kind, entry: fixedEntry, value: data.fixed.value } : undefined;
  return { page: data.page, pageUrl: wikiPageUrl(data.page), compatible, ...(fixed ? { fixed } : {}) };
}
