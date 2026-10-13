/** The quest pages' data from `npm run extract`, validated at build time, and the lookups the pages link with. Server-side only. */
import type { Category } from "../../scripts/extract/config";
import type { Entry } from "../../scripts/extract/schemas";
import { QuestDataSchema, type Quest, type QuestData } from "../../scripts/extract/quest-schema";
import rawQuests from "../data/quests.json";
import { findEntry } from "./data";
import { findMob } from "./mobs";
import type { Mob } from "../../scripts/extract/mob-schema";
import { rewardQuestSlugs, SECTION_KEY, splitItemKey, TYPE_KEY } from "./quest-view";
import { GAME_NAME } from "./site-title";
import { t } from "./ui-strings";
import type { Lang } from "./lang";
import { entryHref, href } from "./url";

export const questData: QuestData = QuestDataSchema.parse(rawQuests);

const QUESTS_BY_SLUG: ReadonlyMap<string, Quest> = new Map(questData.quests.map((quest) => [quest.slug, quest]));

export const findQuest = (slug: string): Quest | undefined => QUESTS_BY_SLUG.get(slug);

export const questHref = (lang: Lang, slug: string): string => href(lang, "quests", slug);

/** The quests these slugs name, skipping any that are not published. */
export const questsOf = (slugs: readonly string[]): Quest[] => slugs.flatMap((slug) => findQuest(slug) ?? []);

/** The published quests that give an item-page quest source ("quest:<row>"); empty when that is not exactly known. */
export const rewardQuests = (sourceId: string): Quest[] => questsOf(rewardQuestSlugs(questData, sourceId));

/** The item entries a reward lists, skipping keys with no published entry. */
export const rewardEntries = (keys: readonly string[]): Entry[] =>
  keys.flatMap((key) => {
    const parts = splitItemKey(key);
    return (parts && findEntry(parts.category as Category, parts.slug)) || [];
  });

/**
 * The page a reward item links to, or undefined when it has none: a book opens its enchantment's page, which is not
 * published for every book (Soul Fire Aspect has no known values).
 */
export function rewardHref(lang: Lang, entry: Entry): string | undefined {
  if (entry.category !== "enchantment-book") return entryHref(lang, entry);
  const enchantment = entry.links.enchantment;
  return enchantment !== undefined && findEntry("enchantment", enchantment) ? entryHref(lang, entry) : undefined;
}

export const questMobs = (quest: Quest): Mob[] => quest.mobs.flatMap((slug) => findMob(slug) ?? []);

/** A quest page's meta description: title, quest type, region, the quest list and the game, in the page language. */
export const questDescription = (quest: Quest, lang: Lang): string =>
  [quest.title.text[lang], t(lang, TYPE_KEY[quest.type]), ...(quest.region ? [quest.region.name[lang]] : []), t(lang, "quests"), GAME_NAME].join(" · ");

export const sectionLabel = (quest: Quest, lang: Lang): string => t(lang, SECTION_KEY[quest.section]);
