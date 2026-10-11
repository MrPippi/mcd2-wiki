/** How an item page presents loot-sources.json: the entry's sources, area links and labels. Server-side only. */
import type { Localized } from "../../scripts/extract/schemas";
import type { Category } from "../../scripts/extract/config";
import { ItemSourcesSchema, type MobArea } from "../../scripts/extract/mob-schema";
import type { Entry } from "../../scripts/extract/schemas";
import rawSources from "../data/loot-sources.json";
import { booksFor } from "./data";
import { categoryLabel } from "./i18n";
import { compareLang, type Lang } from "./lang";
import { sourcesFor, type ResolvedItemSources, type ResolvedSource } from "./item-sources";
import { mapLinkOf, mobData } from "./mobs";

const itemSourcesData = ItemSourcesSchema.parse(rawSources);

/** The category a merchant's stored pool tag stands for. */
const MERCHANT_CATEGORY: Readonly<Record<string, Category>> = {
  "SW.Item.Property.MeleeWeapon": "melee",
  "SW.Item.Property.RangedWeapon": "ranged",
  "SW.Item.Property.Armor": "armor",
  "SW.Item.Property.Artifact": "artifact",
};

export function merchantCategoryLabel(tag: string, lang: Lang): string {
  const category = Object.hasOwn(MERCHANT_CATEGORY, tag) ? MERCHANT_CATEGORY[tag] : undefined;
  if (category === undefined) throw new Error(`loot-sources.json: merchant category ${tag} has no label`);
  return categoryLabel(category, lang);
}

/** Whether this source's name fell back to English for `lang` (English itself is never marked). */
export const nameIsUntranslated = (source: ResolvedSource, lang: Lang): boolean => lang !== "en" && source.untranslated.includes(lang);

/** Whether every source of a group fell back to English for `lang`: the group heading is then marked once instead of each row. */
export const groupIsUntranslated = (sources: readonly ResolvedSource[], lang: Lang): boolean =>
  sources.length > 0 && sources.every((source) => nameIsUntranslated(source, lang));

/**
 * Whether to print the comparison-language name: only when it differs and neither name is an English fallback
 * (an English page must not show the Chinese fallback of an untranslated name).
 */
export const showsAltName = (source: ResolvedSource, lang: Lang): boolean =>
  !nameIsUntranslated(source, lang) && !source.untranslated.includes(compareLang(lang)) && source.name[compareLang(lang)] !== source.name[lang];

export const hasAnySource = (sources: ResolvedItemSources): boolean =>
  sources.areas.length + sources.chests.length + sources.quests.length + sources.merchants.length + sources.bookPools.length > 0;

function uniqueById<T extends ResolvedSource>(lists: readonly (readonly T[])[]): T[] {
  const seen = new Set<string>();
  return lists.flat().filter((source) => !seen.has(source.id) && !!seen.add(source.id));
}

/** One record from several (an enchantment collects its books'), each source once. */
export const mergeSources = (all: readonly ResolvedItemSources[]): ResolvedItemSources => ({
  areas: uniqueById(all.map((s) => s.areas)),
  chests: uniqueById(all.map((s) => s.chests)),
  quests: uniqueById(all.map((s) => s.quests)),
  merchants: uniqueById(all.map((s) => s.merchants)),
  bookPools: uniqueById(all.map((s) => s.bookPools)),
});

const AREA_MARKERS: ReadonlyMap<string, NonNullable<MobArea["map"]>> = new Map(
  mobData.mobs.flatMap((mob) => mob.areas.flatMap((area) => (area.map ? [[`area:${area.areaId}`, area.map] as const] : []))),
);

/** The map page, opened at the area's marker when the mob data placed one. */
export function areaHref(lang: Lang, sourceId: string, name: Localized): string {
  const map = AREA_MARKERS.get(sourceId);
  return mapLinkOf(lang, { areaId: sourceId.replace(/^area:/, ""), name, ...(map ? { map } : {}) });
}

/** Sources of an item page, or undefined when the game data gives it none (the page then shows no block). */
export function entrySources(entry: Entry): ResolvedItemSources | undefined {
  const keys = entry.category === "enchantment" ? booksFor(entry.slug).map((book) => `${book.category}/${book.slug}`) : [`${entry.category}/${entry.slug}`];
  const found = keys.flatMap((key) => sourcesFor(itemSourcesData, key) ?? []);
  const merged = mergeSources(found);
  return hasAnySource(merged) ? merged : undefined;
}
