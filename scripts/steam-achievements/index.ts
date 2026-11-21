/**
 * `npm run steam-achievements`: fetches every site language's achievement names and descriptions from the Steam
 * community stats page and adds them to source-data/Steam/Achievements/achievements.json, then run `npm run extract`.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Lang } from "../../shared/langs";
import { mergeSteamTexts, parseSteamPage, type SteamFile, type SteamText } from "./texts";

const APP_ID = 1912410;
const FILE = path.join("source-data", "Steam", "Achievements", "achievements.json");

/** Steam's language name for each site language other than English (Traditional Chinese is refreshed too). */
const STEAM_LANGUAGE: Readonly<Record<Exclude<Lang, "en">, string>> = {
  zh: "tchinese",
  "zh-hans": "schinese",
  ja: "japanese",
  ko: "koreana",
  de: "german",
  fr: "french",
  es: "spanish",
  it: "italian",
  pt: "brazilian",
  ru: "russian",
  pl: "polish",
  nl: "dutch",
  sv: "swedish",
  tr: "turkish",
  uk: "ukrainian",
};

async function fetchLanguage(language: string): Promise<Map<string, SteamText>> {
  const url = `https://steamcommunity.com/stats/${APP_ID}/achievements/?l=${language}`;
  // The page follows the cookie, not ?l=, for its text.
  const response = await fetch(url, { headers: { Cookie: `Steam_Language=${language}` } });
  if (!response.ok) throw new Error(`Steam ${language}: HTTP ${response.status}`);
  return parseSteamPage(await response.text());
}

async function main(): Promise<void> {
  const file = JSON.parse(await readFile(FILE, "utf8")) as SteamFile;
  const byLang = new Map<Lang, Map<string, SteamText>>();
  for (const [lang, language] of Object.entries(STEAM_LANGUAGE) as [Exclude<Lang, "en">, string][]) {
    byLang.set(lang, await fetchLanguage(language));
    process.stdout.write(`${lang} `);
  }
  const today = new Date().toISOString().slice(0, 10);
  await writeFile(FILE, `${JSON.stringify(mergeSteamTexts(file, byLang, today), null, 2)}\n`, "utf8");
  process.stdout.write(`\n已寫入 ${FILE}，接著執行 npm run extract\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
