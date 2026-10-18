/** Server side of the drop calculator: the item list, source and area names and labels in one language. No zod: the types are shared with the browser script. */
import { CATEGORIES } from "../../../scripts/extract/config";
import { findEntry } from "../data";
import { areaLabel, sourceLabel, type DropLabel } from "../drop-labels";
import { dropAvailable, dropData } from "../drop-view";
import { frameFor } from "../frames";
import { guidesData, plainText } from "../guides";
import { categoryLabel, t, type Lang } from "../i18n";
import { searchNames } from "../lang";
import { assetUrl, entryHref } from "../url";
import type { CalcItem, CalcPayload } from "./parse";

const RARITY_LABEL = { common: "rarityCommon", rare: "rarityRare", special: "raritySpecial", unique: "unique" } as const;

function itemsOf(lang: Lang): CalcItem[] {
  return dropData.items.flatMap((item) => {
    const [category, slug] = item.key.split("/");
    const entry = item.opaque || !slug ? undefined : findEntry(category as Parameters<typeof findEntry>[0], slug);
    if (!entry) return [];
    return [{
      key: item.key,
      name: entry.name[lang],
      search: searchNames(entry.name, lang),
      href: entryHref(lang, entry),
      ...(entry.icon ? { icon: assetUrl(entry.icon) } : {}),
      category: entry.category,
      ...(entry.variant === "unique" ? { unique: true as const } : {}),
    }];
  }).sort((a, b) => a.name.localeCompare(b.name, lang));
}

const labelRecord = (entries: readonly (readonly [string, DropLabel | undefined])[]): Record<string, DropLabel> =>
  Object.fromEntries(entries.flatMap(([id, label]) => (label ? [[id, label]] : [])));

/** Picker groups in the site's category order, only those that have items. */
const categoriesOf = (lang: Lang, items: readonly CalcItem[]): CalcPayload["categories"] =>
  CATEGORIES.filter((category) => items.some((item) => item.category === category)).map((id) => ({ id, name: categoryLabel(id, lang) }));

export function calcPayload(lang: Lang): CalcPayload {
  const items = itemsOf(lang);
  const bookFrame = frameFor("enchantment-book")?.path;
  const areaIds = [...new Set(dropData.sources.flatMap((source) => source.contexts.map(([area]) => area)).filter((id) => id !== ""))];
  return {
    available: dropAvailable,
    items,
    categories: categoriesOf(lang, items),
    ...(bookFrame ? { bookFrame: assetUrl(bookFrame) } : {}),
    levels: dropData.levels,
    defaultLevel: dropData.levels.at(-1) ?? 1,
    difficulties: Object.keys(dropData.difficulties).map((id) => {
      const found = guidesData.difficulty.find((one) => one.id === id);
      return { id, name: found ? plainText(found.name.html[lang]) : id };
    }),
    rarities: [{ id: "any", name: t(lang, "dropRarityAny") }, ...(["common", "rare", "special", "unique"] as const).map((id) => ({ id, name: t(lang, RARITY_LABEL[id]) }))],
    sources: labelRecord(dropData.sources.map((source) => [source.id, sourceLabel(lang, source, dropData.sources)] as const)),
    areas: labelRecord(areaIds.map((id) => [id, areaLabel(lang, id)] as const)),
    labels: {
      pick: t(lang, "dropPickItem"), item: t(lang, "dropItemLabel"), filter: t(lang, "buildSearch"), noItems: t(lang, "buildNoResults"), close: t(lang, "buildClose"),
      threat: t(lang, "affixThreat"), difficulty: t(lang, "guideDifficulty"), rarity: t(lang, "dropTargetRarity"),
      source: t(lang, "dropColSource"), area: t(lang, "soulStormColArea"), chance: t(lang, "dropColChance"),
      allSources: t(lang, "dropAllSources"), allAreas: t(lang, "dropAllAreas"), anyArea: t(lang, "dropNoArea"),
      unplaced: t(lang, "dropAreaUnconfirmed"), summary: t(lang, "dropSummary"), none: t(lang, "dropNoResult"), empty: t(lang, "dropEmpty"), gearOnly: t(lang, "dropRarityGearOnly"),
    },
  };
}

/** The payload as `<script type="application/json">` content: "<" escaped so the text can never close the tag. */
export const calcPayloadJson = (payload: CalcPayload): string => JSON.stringify(payload).replace(/</g, "\\u003c");
