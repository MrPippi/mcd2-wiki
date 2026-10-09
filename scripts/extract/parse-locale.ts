import { CULTURE, LANGS, PATHS, type Lang } from "./config";
import { ExtractError, formatZodIssue } from "./issues";
import { readJsonFile } from "./read-json";
import { LocaleFileSchema, type LocaleFile } from "./schemas";

export async function loadLocaleFile(filePath: string): Promise<LocaleFile> {
  const json = await readJsonFile(filePath, "語系檔");
  if (json === undefined) throw new ExtractError(`找不到語系檔：${filePath}`);
  const parsed = LocaleFileSchema.safeParse(json);
  if (!parsed.success) {
    throw new ExtractError(`語系檔格式錯誤：${filePath} ${formatZodIssue(parsed.error.issues[0])}`);
  }
  return parsed.data;
}

export async function loadLocales(sourceRoot: string): Promise<Record<Lang, LocaleFile>> {
  const [zh, en] = await Promise.all(
    LANGS.map((lang) => loadLocaleFile(PATHS.localeFile(sourceRoot, CULTURE[lang]))),
  );
  return { zh, en };
}
