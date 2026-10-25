/** Server side of the build page: the item lists and texts its browser script needs, in one language. */
import type { Category } from "../../../shared/config";
import type { ArmorSet, ArmorPiece, Entry } from "../../../shared/schemas";
import type { EnchantmentData } from "../../../shared/gear-schema";
import type { WeaponData } from "../../../shared/weapon-schema";
import { allArmorSets, findBaseEntry, publishedEntries } from "../data";
import { enchantmentData } from "../gear-values";
import { GAME_VERSION } from "../game-version";
import { categoryLabel, pieceLabel, t, type Lang, type UiKey } from "../i18n";
import { searchNames } from "../../../shared/lang";
import { assetUrl, entryHref } from "../url";
import { weaponData } from "../weapon-effects";
import { compatibleRowsOf, fixedOf, GEAR, type GearSources } from "./gear";
import type { BuildLabels, BuildOption, BuildPayload, BuildSet, EffectOption, EnchantOption } from "./parse";
import { BUILD_SLOTS, byPool, type BuildSlot, type PoolKey } from "./slots";

const ARMOR_POOLS = ["helmet", "chest", "leggings", "boots"] as const satisfies readonly (PoolKey & ArmorPiece)[];
type ArmorPool = (typeof ARMOR_POOLS)[number];
const isArmorPool = (pool: PoolKey): pool is ArmorPool => (ARMOR_POOLS as readonly PoolKey[]).includes(pool);

const POOL_CATEGORY: Readonly<Record<PoolKey, Category>> = {
  melee: "melee",
  ranged: "ranged",
  helmet: "armor",
  chest: "armor",
  leggings: "armor",
  boots: "armor",
  artifact: "artifact",
  talisman: "talisman",
};

export const inPool = (entry: Entry, pool: PoolKey): boolean =>
  entry.category === POOL_CATEGORY[pool] && (!isArmorPool(pool) || entry.armorPiece === pool);

/** The effect or enchantment a unique item always carries, when it has a released entry; a built-in effect also points into the effect list. */
function fixedBonus(entry: Entry, lang: Lang, gear: GearSources, effectIndex: ReadonlyMap<string, number>): { fixed?: BuildOption["fixed"] } {
  const fixed = fixedOf(entry, gear);
  const bonus = fixed ? findBaseEntry(fixed.kind, fixed.slug) : undefined;
  if (!fixed || !bonus) return {};
  const index = fixed.kind === "effect" ? effectIndex.get(fixed.slug) : undefined;
  const effect = fixed.kind === "effect" ? { effect: true as const, ...(index !== undefined ? { index } : {}), ...(fixed.value !== undefined ? { value: fixed.value } : {}) } : {};
  return { fixed: { name: bonus.name[lang], href: entryHref(lang, bonus), ...effect } };
}

/**
 * Positions in the payload's effect list of the effects this item can roll (only those the list has), without its
 * built-in effect: an item never carries the same effect twice.
 */
function effectIndexes(entry: Entry, gear: GearSources, effectIndex: ReadonlyMap<string, number>, tierSets: TierSets): { effects?: number[]; effectTiers?: number[] } {
  const fixed = fixedOf(entry, gear);
  const builtIn = fixed?.kind === "effect" ? fixed.slug : undefined;
  const rows = compatibleRowsOf(entry, gear).flatMap(({ effect, tiers }) => {
    const index = effect === builtIn ? undefined : effectIndex.get(effect);
    return index === undefined ? [] : [{ index, tiers }];
  });
  return rows.length > 0 ? { effects: rows.map((row) => row.index), effectTiers: rows.map((row) => tierSets.indexOf(row.tiers)) } : {};
}

/** Distinct tier lists, so items that share one point at it instead of repeating it. */
export class TierSets {
  private readonly byKey = new Map<string, number>();
  private readonly lists: number[][] = [];

  indexOf(tiers: readonly number[]): number {
    const key = tiers.join(",");
    const found = this.byKey.get(key);
    if (found !== undefined) return found;
    this.lists.push([...tiers]);
    this.byKey.set(key, this.lists.length - 1);
    return this.lists.length - 1;
  }

  get all(): readonly (readonly number[])[] {
    return this.lists;
  }
}

const optionOf = (entry: Entry, lang: Lang, gear: GearSources, effectIndex: ReadonlyMap<string, number>, tierSets: TierSets): BuildOption => ({
  slug: entry.slug,
  name: entry.name[lang],
  search: searchNames(entry.name, lang),
  ...(entry.icon ? { icon: assetUrl(entry.icon) } : {}),
  href: entryHref(lang, entry),
  ...(entry.variant === "unique" ? { unique: true } : {}),
  ...fixedBonus(entry, lang, gear, effectIndex),
  ...effectIndexes(entry, gear, effectIndex, tierSets),
});

const NO_EFFECTS: ReadonlyMap<string, number> = new Map();

export const poolOptions = (
  pool: PoolKey,
  lang: Lang,
  entries: readonly Entry[] = publishedEntries,
  gear: GearSources = GEAR,
  effectIndex: ReadonlyMap<string, number> = NO_EFFECTS,
  tierSets: TierSets = new TierSets(),
): BuildOption[] => entries.filter((entry) => inPool(entry, pool)).map((entry) => optionOf(entry, lang, gear, effectIndex, tierSets));

/** Released effects, as the payload's shared effect list, with how the game prints each one's magnitude. */
export const effectOptions = (lang: Lang, entries: readonly Entry[] = publishedEntries, formats: WeaponData["effectFormats"] = weaponData.effectFormats): EffectOption[] =>
  entries
    .filter((entry) => entry.category === "effect")
    .map((entry) => ({
      slug: entry.slug,
      name: entry.name[lang],
      search: searchNames(entry.name, lang),
      ...(entry.icon ? { icon: assetUrl(entry.icon) } : {}),
      href: entryHref(lang, entry),
      ...(formats[entry.slug] ? { format: formats[entry.slug] } : {}),
    }));

/** Enchantments a player can put on gear: released, not a unique weapon's own, and naming at least one slot. */
export function enchantOptions(lang: Lang, entries: readonly Entry[] = publishedEntries, data: EnchantmentData = enchantmentData): EnchantOption[] {
  return entries.flatMap((entry) => {
    const slots = entry.category === "enchantment" && entry.variant === "normal" ? data[entry.slug]?.slots : undefined;
    if (!slots) return [];
    return [
      {
        slug: entry.slug,
        name: entry.name[lang],
        search: searchNames(entry.name, lang),
        ...(entry.icon ? { icon: assetUrl(entry.icon) } : {}),
        href: entryHref(lang, entry),
        slots,
        tiers: data[entry.slug]?.tiers ?? [],
      },
    ];
  });
}

/** Sets whose four pieces can all be picked; others would fill the armor slots only in part. */
export function wholeSets(lang: Lang, sets: readonly ArmorSet[] = allArmorSets, entries: readonly Entry[] = publishedEntries): BuildSet[] {
  return sets.flatMap((set) => {
    const found = ARMOR_POOLS.map((piece) => entries.find((entry) => entry.slug === set.pieces[piece] && inPool(entry, piece)));
    const [helmet, chest, leggings, boots] = found.map((entry) => entry?.slug);
    if (!helmet || !chest || !leggings || !boots) return [];
    return [{ slug: set.slug, name: set.name[lang], search: searchNames(set.name, lang), pieces: { helmet, chest, leggings, boots } }];
  });
}

/** Singular names for the slots whose category label is a plural list name. */
const SINGULAR: Partial<Record<PoolKey, UiKey>> = { artifact: "buildSlotArtifact", talisman: "buildSlotTalisman" };

/** Slot names: the piece, a singular item name or the weapon category, numbered where the game has several of a kind. */
export function slotLabel(slot: BuildSlot, lang: Lang): string {
  const singular = SINGULAR[slot.pool];
  const base = isArmorPool(slot.pool) ? pieceLabel(slot.pool, lang) : singular ? t(lang, singular) : categoryLabel(POOL_CATEGORY[slot.pool], lang);
  return slot.pool === "artifact" || slot.pool === "talisman" ? `${base} ${slot.index + 1}` : base;
}

const labelsFor = (lang: Lang): BuildLabels => ({
  slots: Object.fromEntries(BUILD_SLOTS.map((slot) => [slot.key, slotLabel(slot, lang)])) as BuildLabels["slots"],
  choose: t(lang, "buildChoose"),
  clear: t(lang, "buildClear"),
  search: t(lang, "buildSearch"),
  noResults: t(lang, "buildNoResults"),
  wholeSet: t(lang, "buildWholeSet"),
  equipped: t(lang, "buildEquipped"),
  close: t(lang, "buildClose"),
  copied: t(lang, "buildCopied"),
  copyFailed: t(lang, "buildCopyFailed"),
  downloadFailed: t(lang, "buildDownloadFailed"),
  dropped: t(lang, "buildDropped"),
  unsupported: t(lang, "buildUnsupported"),
  gameVersion: t(lang, "buildGameVersion"),
  oldVersion: t(lang, "buildOldVersion"),
  effect: t(lang, "buildEffect"),
  addEffect: t(lang, "buildAddEffect"),
  removeEffect: t(lang, "buildRemoveEffect"),
  enchant: t(lang, "buildEnchant"),
  addEnchant: t(lang, "buildAddEnchant"),
  removeEnchant: t(lang, "buildRemoveEnchant"),
  tier: t(lang, "buildTier"),
  builtIn: t(lang, "buildBuiltIn"),
  cardTitle: t(lang, "build"),
  siteTitle: t(lang, "siteTitle"),
  totals: t(lang, "buildTotals"),
  totalsNote: t(lang, "buildTotalsNote"),
  totalsEffects: t(lang, "buildTotalsEffects"),
  totalsEnchants: t(lang, "buildTotalsEnchants"),
  totalsSum: t(lang, "buildTotalsSum"),
  totalsBuiltIn: t(lang, "buildTotalsBuiltIn"),
});

export function buildPayload(lang: Lang): BuildPayload {
  const effects = effectOptions(lang);
  const effectIndex = new Map(effects.map((effect, index) => [effect.slug, index]));
  const tierSets = new TierSets();
  const pools = byPool((pool) => poolOptions(pool, lang, publishedEntries, GEAR, effectIndex, tierSets));
  return {
    gameVersion: GAME_VERSION,
    pools,
    effects,
    tierSets: tierSets.all,
    sets: wholeSets(lang),
    enchantments: enchantOptions(lang),
    labels: labelsFor(lang),
  };
}

/** The payload as `<script type="application/json">` content: "<" escaped so the text can never close the tag. */
export const payloadJson = (payload: BuildPayload): string => JSON.stringify(payload).replace(/</g, "\\u003c");
