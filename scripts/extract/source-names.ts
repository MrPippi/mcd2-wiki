/** Display names for item sources (merchants, chests, mobs, quests, book pools, areas): the game's text when known, else English words. */
import { z } from "zod";
import { localizedFrom } from "../../src/lib/lang";
import { plainText, UI_DICTS } from "../../src/lib/ui-dicts";
import type { Lang } from "./config";
import { ExtractError } from "./issues";
import { LANGS } from "./langs";
import { englishFallbacks, localize, type LocRef } from "./loc-table";
import type { LocaleFile, Localized } from "./schemas";
import keyData from "./source-name-keys.json";

export type NameKeys = Readonly<Record<string, LocRef>>;
/** The kinds of named source besides areas. */
export type SourceKind = "merchant" | "chest" | "mob" | "quest" | "bookPool";

/** A quest with no game name is shown by this site label alone: its row id (QuestArtifactsCA10_BR_B) is not a name. */
const QUEST_LABEL_KEY = "sourceQuestReward";
/** Rows the game gives no name but the site labels: the global book pool every area draws from, and the chests. */
const SITE_LABEL_KEYS: Readonly<Record<string, string>> = {
  EnchantmentBooksCommon: "sourceBookPoolCommon",
  FancyChest: "sourceChestFancy",
  WellspringChest: "sourceChestWellspring",
  CampWoodenChest: "sourceChestCamp",
};
/** A secret talisman chest has no game name either: the site's label, then the one talisman it holds. */
const TALISMAN_CHEST_KEY = "sourceChestTalisman";
const NON_ENGLISH: readonly Lang[] = LANGS.filter((lang) => lang !== "en");

export const SOURCE_NAME_KEYS: NameKeys = z.record(z.string(), z.object({ namespace: z.string(), key: z.string() })).parse(keyData);

/** "QuestArmourMushroomSet" + /^Quest/ -> "Armour Mushroom Set"; "FancyChest_Procedural" -> "Fancy Chest Procedural". */
export function humanizeId(id: string, stripPrefix?: RegExp): string {
  const rest = stripPrefix ? id.replace(stripPrefix, "") : id;
  return rest
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word !== "")
    .join(" ");
}

export interface SourceName {
  readonly name: Localized;
  /** Languages that show English text. */
  readonly untranslated: readonly Lang[];
  /** True when the text is the game's own. */
  readonly official: boolean;
}

const siteLabel = (key: string) => (lang: Lang): string => {
  const value = UI_DICTS[lang].values[key];
  if (value === undefined) throw new ExtractError(`src/i18n/${lang}.json 缺少介面字串 ${key}`);
  return plainText(value);
};

/** "Talisman Chest · <item>"; the item name's untranslated languages carry over. */
export const talismanChestName = (item: Localized, itemUntranslated: readonly Lang[]): SourceName => {
  const label = siteLabel(TALISMAN_CHEST_KEY);
  return { name: localizedFrom((lang) => `${label(lang)} · ${item[lang]}`), untranslated: itemUntranslated, official: false };
};

/**
 * The game's text when `keys[id]` points at an English locale string. Otherwise a quest gets the site's translated
 * "Quest reward" label (a row in SITE_LABEL_KEYS its own label), and any other source the id as English words (no kind prefix: the group heading gives the
 * kind) with every language but English marked untranslated.
 */
export function sourceName(id: string, keys: NameKeys, locales: Readonly<Record<Lang, LocaleFile>>, stripPrefix?: RegExp, kind?: SourceKind): SourceName {
  const ref = Object.hasOwn(keys, id) ? keys[id] : undefined;
  const official = ref ? localize(locales, ref.namespace, ref.key) : undefined;
  if (ref && official) return { name: official, untranslated: englishFallbacks(locales, ref.namespace, ref.key), official: true };
  const labelKey = kind === "quest" ? QUEST_LABEL_KEY : Object.hasOwn(SITE_LABEL_KEYS, id) ? SITE_LABEL_KEYS[id] : undefined;
  if (labelKey !== undefined) return { name: localizedFrom(siteLabel(labelKey)), untranslated: [], official: false };
  const words = humanizeId(id, stripPrefix);
  return { name: localizedFrom(() => words), untranslated: NON_ENGLISH, official: false };
}
