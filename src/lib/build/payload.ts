/** Server side of the build page: the item lists and texts its browser script needs, in one language. */
import type { Category } from "../../../scripts/extract/config";
import type { ArmorSet, ArmorPiece, Entry } from "../../../scripts/extract/schemas";
import type { EnchantmentData } from "../../../scripts/extract/gear-schema";
import type { WeaponData } from "../../../scripts/extract/weapon-schema";
import { allArmorSets, findBaseEntry, publishedEntries } from "../data";
import { enchantmentData } from "../gear-values";
import { weaponData } from "../weapon-effects";
import { GAME_VERSION } from "../game-version";
import { categoryLabel, pieceLabel, t, type Lang, type UiKey } from "../i18n";
import { searchNames } from "../lang";
import { assetUrl, entryHref } from "../url";
import type { BuildLabels, BuildOption, BuildPayload, BuildSet, EnchantOption } from "./parse";
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

/** The effect or enchantment a unique weapon always carries, when it has a released entry. */
function fixedBonus(entry: Entry, lang: Lang, weapons: WeaponData["weapons"]): { fixed?: BuildOption["fixed"] } {
  const fixed = weapons[entry.slug]?.fixed;
  const bonus = fixed ? findBaseEntry(fixed.kind, fixed.slug) : undefined;
  return bonus ? { fixed: { name: bonus.name[lang], href: entryHref(lang, bonus) } } : {};
}

const optionOf = (entry: Entry, lang: Lang, weapons: WeaponData["weapons"]): BuildOption => ({
  slug: entry.slug,
  name: entry.name[lang],
  search: searchNames(entry.name, lang),
  ...(entry.icon ? { icon: assetUrl(entry.icon) } : {}),
  href: entryHref(lang, entry),
  ...(entry.variant === "unique" ? { unique: true } : {}),
  ...fixedBonus(entry, lang, weapons),
});

export const poolOptions = (pool: PoolKey, lang: Lang, entries: readonly Entry[] = publishedEntries, weapons: WeaponData["weapons"] = weaponData.weapons): BuildOption[] =>
  entries.filter((entry) => inPool(entry, pool)).map((entry) => optionOf(entry, lang, weapons));

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
  enchant: t(lang, "buildEnchant"),
  addEnchant: t(lang, "buildAddEnchant"),
  removeEnchant: t(lang, "buildRemoveEnchant"),
  tier: t(lang, "buildTier"),
  builtIn: t(lang, "buildBuiltIn"),
  cardTitle: t(lang, "build"),
  siteTitle: t(lang, "siteTitle"),
});

export const buildPayload = (lang: Lang): BuildPayload => ({
  gameVersion: GAME_VERSION,
  pools: byPool((pool) => poolOptions(pool, lang)),
  sets: wholeSets(lang),
  enchantments: enchantOptions(lang),
  labels: labelsFor(lang),
});

/** The payload as `<script type="application/json">` content: "<" escaped so the text can never close the tag. */
export const payloadJson = (payload: BuildPayload): string => JSON.stringify(payload).replace(/</g, "\\u003c");
