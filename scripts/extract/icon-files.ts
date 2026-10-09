import { readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { ExtractError, formatZodIssue } from "./issues";
import type { IconOverrides } from "./match-icons";
import { readJsonFile } from "./read-json";

const ICON_FILE = /(?:^|\/)T_UI_[^/]*\.png$/i;
const OverridesSchema = z.record(z.string(), z.string().nullable());

export async function listIconFiles(
  sourceRoot: string,
  iconRoot: string,
  pattern: RegExp = ICON_FILE,
): Promise<string[] | null> {
  const root = path.join(sourceRoot, ...iconRoot.split("/"));
  try {
    const names = await readdir(root, { recursive: true });
    return names
      .map((name) => name.split(path.sep).join("/"))
      .filter((name) => pattern.test(name))
      .map((name) => `${iconRoot}/${name}`)
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new ExtractError(`無法讀取圖示目錄：${root}（${(error as Error).message}）`);
  }
}

export async function loadOverrides(filePath: string): Promise<IconOverrides> {
  const json = await readJsonFile(filePath, "圖示對照檔");
  if (json === undefined) return {};
  const parsed = OverridesSchema.safeParse(json);
  if (!parsed.success) {
    throw new ExtractError(`圖示對照檔格式錯誤：${filePath} ${formatZodIssue(parsed.error.issues[0])}`);
  }
  return parsed.data;
}
