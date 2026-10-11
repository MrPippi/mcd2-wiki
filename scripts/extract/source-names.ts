/** Display names for item sources (merchants, chests, quests, book pools, areas): the game's text when known, else English words. */
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
/** The kinds of source that have a site label to wrap a fallback name in. */
export type SourceKind = "merchant" | "chest" | "quest" | "bookPool";

const KIND_KEYS: Readonly<Record<SourceKind, string>> = {
  merchant: "sourceNameMerchant",
  chest: "sourceNameChest",
  quest: "sourceNameQuest",
  bookPool: "sourceNameBookPool",
};
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

function kindLabel(kind: SourceKind, lang: Lang, words: string): string {
  const value = UI_DICTS[lang].values[KIND_KEYS[kind]];
  if (value === undefined) throw new ExtractError(`src/i18n/${lang}.json 缺少介面字串 ${KIND_KEYS[kind]}`);
  return plainText(value).replace("{name}", words);
}

/**
 * The game's text when `keys[id]` points at an English locale string; otherwise the id as English words, wrapped in the
 * site's label for `kind` when one is given, with every language but English marked untranslated.
 */
export function sourceName(id: string, keys: NameKeys, locales: Readonly<Record<Lang, LocaleFile>>, stripPrefix?: RegExp, kind?: SourceKind): SourceName {
  const ref = Object.hasOwn(keys, id) ? keys[id] : undefined;
  const official = ref ? localize(locales, ref.namespace, ref.key) : undefined;
  if (ref && official) return { name: official, untranslated: englishFallbacks(locales, ref.namespace, ref.key), official: true };
  const words = humanizeId(id, stripPrefix);
  const name = localizedFrom((lang) => (kind ? kindLabel(kind, lang, words) : words));
  return { name, untranslated: NON_ENGLISH, official: false };
}
