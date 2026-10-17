/** The effect odds table of an item page: rows and the default (threat 20, first rarity, no bonus) values the page prints without scripts. Server-side only. */
import { AffixDataSchema } from "../../scripts/extract/affix-schema";
import type { Entry } from "../../scripts/extract/schemas";
import rawAffix from "../data/affix-models.json";
import { formatOdds, itemOdds, type AffixFile, type AffixOdds } from "./affix-odds";
import { publishedEntries } from "./data";
import type { UiKey } from "./i18n";
import { RARITY_LABEL, type RarityTier } from "./rarity";

/** The odds models from `npm run extract`, validated at build time. */
export const affixData: AffixFile = AffixDataSchema.parse(rawAffix);

export interface AffixRowView {
  readonly effect: Entry;
  /** The item always has the effect: 100%, no tiers. */
  readonly fixed: boolean;
  /** Tier I, II and III, formatted. */
  readonly tiers: readonly [string, string, string];
  /** Any tier, formatted. */
  readonly any: string;
}

export interface AffixView {
  readonly slug: string;
  readonly levels: readonly number[];
  readonly level: number;
  readonly rarities: readonly { readonly rarity: string; readonly label: UiKey; readonly slots: number; readonly bonusSlots: number }[];
  readonly rarity: string;
  readonly rows: readonly AffixRowView[];
}

const NONE = "–";
const CATEGORIES: ReadonlySet<Entry["category"]> = new Set(["melee", "ranged", "armor", "artifact"]);

const effectEntry = (slug: string): Entry | undefined => publishedEntries.find((entry) => entry.category === "effect" && entry.slug === slug);

/** Every effect the item's pool has a published page for, whether or not it can roll at the default threat: the page script fills the same rows. */
function rowsOf(file: AffixFile, slug: string, odds: AffixOdds): AffixRowView[] {
  const item = file.items[slug];
  const fixed = item.fixed.flatMap((effect) => effectEntry(effect) ?? []).map((effect): AffixRowView => ({ effect, fixed: true, tiers: [NONE, NONE, NONE], any: "100%" }));
  const pooled = [...new Set(file.models[item.model].entries.map((entry) => entry.effect))].filter((effect) => !item.fixed.includes(effect));
  const rolled = pooled.flatMap((effect) => {
    const entry = effectEntry(effect);
    const chance = (tier: number) => odds.templates.find((found) => found.effect === effect && found.tier === tier)?.probability ?? 0;
    const any = odds.effects.find((found) => found.effect === effect)?.probability ?? 0;
    return entry ? [{ effect: entry, fixed: false, tiers: [formatOdds(chance(1)), formatOdds(chance(2)), formatOdds(chance(3))] as const, any: formatOdds(any) }] : [];
  });
  return [...fixed, ...rolled.sort((a, b) => a.effect.name.en.localeCompare(b.effect.name.en, "en"))];
}

/** The table of a melee weapon, ranged weapon, armor piece or artifact; undefined for anything else or an item without random effects. */
export function affixViewOf(entry: Entry, file: AffixFile = affixData): AffixView | undefined {
  const item = CATEGORIES.has(entry.category) && Object.hasOwn(file.items, entry.slug) ? file.items[entry.slug] : undefined;
  const level = file.levels.at(-1);
  const first = item?.rarities[0];
  if (!item || level === undefined || !first) return undefined;
  const odds = itemOdds(file, entry.slug, { level, rarity: first.rarity, bonus: false });
  if (!odds) return undefined;
  return {
    slug: entry.slug,
    levels: file.levels,
    level,
    rarities: item.rarities.map((one) => ({ ...one, label: RARITY_LABEL[one.rarity as RarityTier] })),
    rarity: first.rarity,
    rows: rowsOf(file, entry.slug, odds),
  };
}
