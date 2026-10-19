/**
 * Steam achievements (source-data/Steam/Achievements): names, descriptions and global unlock rates in English and
 * Traditional Chinese, plus one 256×256 jpg per achievement. The game ships no achievement text of its own, so every
 * other language shows the English text and is recorded in `untranslated`.
 */
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { localizedFrom } from "../../shared/lang";
import { ACHIEVEMENT_DEFINITIONS_FILE, buildConditions, loadAchievementDefinitions } from "./achievement-conditions";
import {
  AchievementDataSchema,
  type AchievementCondition,
  SteamAchievementsSchema,
  type Achievement,
  type AchievementData,
  type SteamAchievement,
  type SteamAchievements,
} from "../../shared/achievement-schema";
import { LANGS, type Lang } from "../../shared/langs";
import { ExtractError, formatZodIssue, issue, type Issue } from "./issues";
import { readJsonFile } from "./read-json";
import type { LocaleFile, Localized } from "../../shared/schemas";

export type { SteamAchievements };

export const ACHIEVEMENTS_DIR = "Steam/Achievements";
const ACHIEVEMENTS_FILE = "achievements.json";
/** Published icon edge in pixels: twice the largest size the page shows, for sharp high-density screens. */
export const ACHIEVEMENT_ICON_SIZE = 128;
const WEBP_QUALITY = 82;

export interface AchievementIcon {
  /** File name inside the Steam achievements folder. */
  readonly file: string;
  /** Published path under public/. */
  readonly published: string;
}

export interface AchievementsResult {
  readonly data: AchievementData;
  readonly icons: AchievementIcon[];
  readonly issues: Issue[];
}

export const achievementSlug = (id: string): string => id.toLowerCase().replace(/_+/g, "-");

const iconPath = (id: string): string => `icons/achievements/${achievementSlug(id)}.webp`;

export function parseSteamAchievements(raw: unknown, filePath: string): SteamAchievements {
  const parsed = SteamAchievementsSchema.safeParse(raw);
  if (!parsed.success) throw new ExtractError(`Steam 成就檔驗證失敗：${filePath}（${formatZodIssue(parsed.error.issues[0])}）`);
  return parsed.data;
}

/** Text in every language: Steam's own English and Chinese, English for the rest; `missing` lists the English stand-ins. */
function localizeSteam(text: { readonly en: string; readonly zh: string }): { value: Localized; missing: Lang[] } {
  const own = (lang: Lang): string | undefined => (lang === "en" ? text.en : lang === "zh" ? text.zh.trim() || undefined : undefined);
  return {
    value: localizedFrom((lang) => own(lang) ?? text.en),
    missing: LANGS.filter((lang) => own(lang) === undefined),
  };
}

function toAchievement(row: SteamAchievement, hasIcon: boolean, condition: AchievementCondition | undefined): Achievement {
  const hidden = row.description.en.trim() === "";
  const name = localizeSteam(row.name);
  const description = hidden ? undefined : localizeSteam(row.description);
  const missing = new Set([...name.missing, ...(description?.missing ?? [])]);
  return {
    id: row.id,
    slug: achievementSlug(row.id),
    ...(hasIcon ? { icon: iconPath(row.id) } : {}),
    globalPercent: row.globalPercent,
    hidden,
    name: name.value,
    ...(description ? { description: description.value } : {}),
    ...(hidden && condition ? { condition } : {}),
    ...(missing.size > 0 ? { untranslated: LANGS.filter((lang) => missing.has(lang)) } : {}),
  };
}

const byRateThenId = (a: SteamAchievement, b: SteamAchievement): number =>
  b.globalPercent - a.globalPercent || a.id.localeCompare(b.id, "en");

/**
 * Site data for the achievements page, highest unlock rate first. `iconExists` checks a file name in the Steam folder;
 * `conditions` (by Steam id) name what unlocks the hidden ones.
 */
export function buildAchievements(
  steam: SteamAchievements,
  iconExists: (file: string) => boolean,
  conditions: ReadonlyMap<string, AchievementCondition> = new Map(),
): AchievementsResult {
  const rows = [...steam.achievements].sort(byRateThenId);
  const achievements = rows.map((row) => toAchievement(row, iconExists(row.file), conditions.get(row.id)));
  return {
    data: { source: steam.source, retrieved: steam.retrieved, achievements },
    icons: rows
      .filter((row) => iconExists(row.file))
      .map((row) => ({ file: row.file, published: iconPath(row.id) }))
      .sort((a, b) => a.published.localeCompare(b.published, "en")),
    issues: [
      ...rows.filter((row) => !iconExists(row.file)).map((row) => issue("missing-achievement-icon", row.file)),
      ...achievements.flatMap((item) =>
        item.untranslated ? [issue("achievement-text-fallback", `${item.id}: ${item.untranslated.join(", ")}`)] : [],
      ),
    ],
  };
}

/** Writes each icon as a small webp; run after public/icons is rebuilt, since that step clears the folder. */
async function publishIcons(folder: string, outRoot: string, icons: readonly AchievementIcon[]): Promise<void> {
  for (const icon of icons) {
    const to = path.join(outRoot, "public", ...icon.published.split("/"));
    await mkdir(path.dirname(to), { recursive: true });
    await sharp(path.join(folder, icon.file)).resize(ACHIEVEMENT_ICON_SIZE, ACHIEVEMENT_ICON_SIZE).webp({ quality: WEBP_QUALITY }).toFile(to);
  }
}

/** Hidden achievements' unlock conditions from the game's table; a missing table is reported and the page goes without. */
async function hiddenConditions(sourceRoot: string, steam: SteamAchievements, locales: Readonly<Record<Lang, LocaleFile>>) {
  const rows = await loadAchievementDefinitions(sourceRoot);
  if (!rows) return { conditions: new Map<string, AchievementCondition>(), issues: [issue("missing-achievement-definitions", ACHIEVEMENT_DEFINITIONS_FILE)] };
  const hidden = steam.achievements.filter((row) => row.description.en.trim() === "").map((row) => row.id);
  return buildConditions(rows, locales, hidden);
}

/** Reads the Steam achievements, publishes their icons and returns the page data; without the folder the list is empty. */
export async function extractAchievements(
  sourceRoot: string,
  outRoot: string,
  locales: Readonly<Record<Lang, LocaleFile>>,
): Promise<AchievementsResult> {
  const folder = path.join(sourceRoot, ...ACHIEVEMENTS_DIR.split("/"));
  const filePath = path.join(folder, ACHIEVEMENTS_FILE);
  const raw = await readJsonFile(filePath, "Steam 成就檔");
  if (raw === undefined) {
    return { data: { source: "", retrieved: "", achievements: [] }, icons: [], issues: [issue("missing-achievements", `${ACHIEVEMENTS_DIR}/${ACHIEVEMENTS_FILE}`)] };
  }
  const steam = parseSteamAchievements(raw, filePath);
  const conditions = await hiddenConditions(sourceRoot, steam, locales);
  const result = buildAchievements(steam, (file) => existsSync(path.join(folder, file)), conditions.conditions);
  await publishIcons(folder, outRoot, result.icons);
  return { ...result, data: AchievementDataSchema.parse(result.data), issues: [...result.issues, ...conditions.issues] };
}
