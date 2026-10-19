import { PATHS } from "./config";
import { LANGS, LANG_META, type Lang } from "../../shared/config";
import { byLang } from "../../shared/lang";
import { ExtractError, formatZodIssue } from "./issues";
import { readJsonFile } from "./read-json";
import { LocaleFileSchema, type LocaleFile } from "../../shared/schemas";

export async function loadLocaleFile(filePath: string): Promise<LocaleFile> {
  const json = await readJsonFile(filePath, "語系檔");
  if (json === undefined) throw new ExtractError(`找不到語系檔：${filePath}`);
  const parsed = LocaleFileSchema.safeParse(json);
  if (!parsed.success) {
    throw new ExtractError(`語系檔格式錯誤：${filePath} ${formatZodIssue(parsed.error.issues[0])}`);
  }
  return parsed.data;
}

/** Every language's locale file; a missing file fails the extract and names the file. */
export async function loadLocales(sourceRoot: string): Promise<Record<Lang, LocaleFile>> {
  const files = await Promise.all(LANGS.map((lang) => loadLocaleFile(PATHS.localeFile(sourceRoot, LANG_META[lang].culture))));
  const byIndex = new Map(LANGS.map((lang, i) => [lang, files[i]]));
  return byLang((lang) => byIndex.get(lang) ?? {});
}
