/**
 * Steam achievement text per language. The game ships none, so names and descriptions come from the Steam community
 * stats page, which embeds the achievements (by API name, the game's AchievementId) as JSON in its SSR data script.
 */
import type { Lang } from "../../shared/langs";

export interface SteamText {
  readonly name: string;
  readonly description: string;
}

/** The shape of source-data/Steam/Achievements/achievements.json this script reads and writes. */
export interface SteamFile {
  readonly source: string;
  readonly retrieved: string;
  /** When `npm run steam-achievements` last fetched the text; `retrieved` dates the unlock rates. */
  readonly textsRetrieved?: string;
  readonly achievements: readonly SteamFileRow[];
}
interface SteamFileRow {
  readonly id: string;
  readonly name: Readonly<Partial<Record<Lang, string>>> & { readonly en: string };
  readonly description: Readonly<Partial<Record<Lang, string>>> & { readonly en: string };
  readonly [key: string]: unknown;
}

const SSR_DATA = /<script type="application\/json" id="valve-ssr-data"[^>]*>([\s\S]*?)<\/script>/;

interface RawAchievement {
  readonly api_name: string;
  readonly name: string;
  readonly description: string;
}
const isAchievement = (value: unknown): value is RawAchievement =>
  typeof value === "object" && value !== null && typeof (value as RawAchievement).api_name === "string"
  && typeof (value as RawAchievement).name === "string" && typeof (value as RawAchievement).description === "string";

/** A string that is itself JSON holding achievements (Steam nests the page data as JSON strings), parsed; else undefined. */
function nestedJson(value: string): unknown {
  const start = value.trimStart()[0];
  if ((start !== "{" && start !== "[") || !value.includes("api_name")) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

/** Every achievement object anywhere in a parsed value, including inside nested JSON strings. */
function collect(value: unknown): RawAchievement[] {
  if (isAchievement(value)) return [value];
  if (typeof value === "string") {
    const nested = nestedJson(value);
    return nested === undefined ? [] : collect(nested);
  }
  if (Array.isArray(value)) return value.flatMap(collect);
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap(collect);
  return [];
}

/** Name and description of each achievement on a Steam stats page, by API name. */
export function parseSteamPage(html: string): Map<string, SteamText> {
  const script = SSR_DATA.exec(html)?.[1];
  if (!script) throw new Error("Steam page has no valve-ssr-data script");
  const found = collect(JSON.parse(script) as unknown);
  if (found.length === 0) throw new Error("Steam page valve-ssr-data holds no achievements");
  return new Map(found.map((row) => [row.api_name, { name: row.name, description: row.description }]));
}

const textOf = (texts: ReadonlyMap<string, SteamText>, lang: Lang, id: string): SteamText => {
  const text = texts.get(id);
  if (!text) throw new Error(`Steam ${lang} page has no achievement ${id}`);
  return text;
};

/**
 * Whether Steam has the language at all: it serves every name in English for one it lacks. A single name equal to the
 * English (e.g. "Ka-BOOM!") is the translation, not a gap.
 */
const isTranslated = (file: SteamFile, lang: Lang, texts: ReadonlyMap<string, SteamText>): boolean =>
  file.achievements.some((row) => textOf(texts, lang, row.id).name.trim() !== row.name.en.trim());

const nonEmpty = (text: string): string | undefined => text.trim() || undefined;

function mergeRow(row: SteamFileRow, byLang: ReadonlyMap<Lang, ReadonlyMap<string, SteamText>>): SteamFileRow {
  const hidden = row.description.en.trim() === "";
  const entries = [...byLang].map(([lang, texts]) => {
    const text = textOf(texts, lang, row.id);
    return { lang, name: nonEmpty(text.name), description: hidden ? undefined : nonEmpty(text.description) };
  });
  const pick = (field: "name" | "description") =>
    Object.fromEntries(entries.flatMap((entry) => (entry[field] === undefined ? [] : [[entry.lang, entry[field]]])));
  return { ...row, name: { ...row.name, ...pick("name") }, description: { ...row.description, ...pick("description") } };
}

/**
 * The achievements file with the text of each fetched language Steam has added; a language Steam serves only in English
 * is left out. Hidden achievements keep empty descriptions.
 */
export function mergeSteamTexts(file: SteamFile, byLang: ReadonlyMap<Lang, ReadonlyMap<string, SteamText>>, textsRetrieved: string): SteamFile {
  const translated = new Map([...byLang].filter(([lang, texts]) => isTranslated(file, lang, texts)));
  return { ...file, textsRetrieved, achievements: file.achievements.map((row) => mergeRow(row, translated)) };
}
