/** Server side of the weapon comparison: every released weapon's cells and effects, in one language. */
import type { Entry } from "../../../scripts/extract/schemas";
import type { WeaponData } from "../../../scripts/extract/weapon-schema";
import { findBaseEntry, publishedEntries } from "../data";
import { categoryLabel, t, type Lang } from "../i18n";
import { searchNames } from "../lang";
import { assetUrl, entryHref } from "../url";
import { weaponData } from "../weapon-effects";
import type { CompareLabels, ComparePayload, CompareWeapon } from "./parse";
import { compareCells, compareRows } from "./rows";

const effectNames = (lang: Lang, slugs: readonly string[]): string[] =>
  slugs.flatMap((slug) => {
    const effect = findBaseEntry("effect", slug);
    return effect ? [effect.name[lang]] : [];
  });

function weaponOf(lang: Lang, entry: Entry, weapons: WeaponData["weapons"]): CompareWeapon[] {
  const data = weapons[entry.slug];
  if (!data || (entry.category !== "melee" && entry.category !== "ranged")) return [];
  const fixed = data.fixed ? findBaseEntry(data.fixed.kind, data.fixed.slug) : undefined;
  return [
    {
      slug: entry.slug,
      kind: entry.category,
      name: entry.name[lang],
      search: searchNames(entry.name, lang),
      ...(entry.icon ? { icon: assetUrl(entry.icon) } : {}),
      href: entryHref(lang, entry),
      ...(entry.variant === "unique" ? { unique: true } : {}),
      cells: compareCells(lang, data),
      effects: effectNames(lang, data.compatible.map((row) => row.effect)),
      ...(fixed ? { fixed: fixed.name[lang] } : {}),
    },
  ];
}

export const compareWeapons = (lang: Lang, entries: readonly Entry[] = publishedEntries, weapons: WeaponData["weapons"] = weaponData.weapons): CompareWeapon[] =>
  entries.flatMap((entry) => weaponOf(lang, entry, weapons));

const labelsFor = (lang: Lang): CompareLabels => ({
  add: t(lang, "weaponCompareAdd"),
  added: t(lang, "weaponCompareAdded"),
  stat: t(lang, "weaponCompareStat"),
  effects: t(lang, "weaponCompareEffects"),
  best: t(lang, "weaponCompareBest"),
  builtIn: t(lang, "weaponCompareBuiltIn"),
  empty: t(lang, "weaponCompareEmpty"),
  dropped: t(lang, "weaponCompareDropped"),
  melee: categoryLabel("melee", lang),
  ranged: categoryLabel("ranged", lang),
  copied: t(lang, "buildCopied"),
  copyFailed: t(lang, "buildCopyFailed"),
  clear: t(lang, "buildClear"),
  close: t(lang, "buildClose"),
  filter: t(lang, "buildSearch"),
  noResults: t(lang, "buildNoResults"),
});

export const comparePayload = (lang: Lang): ComparePayload => ({ rows: compareRows(lang), weapons: compareWeapons(lang), labels: labelsFor(lang) });

/** The payload as `<script type="application/json">` content: "<" escaped so the text can never close the tag. */
export const comparePayloadJson = (payload: ComparePayload): string => JSON.stringify(payload).replace(/</g, "\\u003c");
