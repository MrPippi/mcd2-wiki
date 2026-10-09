import { readFile } from "node:fs/promises";
import { ExtractError } from "./issues";

const isNotFound = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === "ENOENT";

export async function readJsonFile(filePath: string, label: string): Promise<unknown | undefined> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if (isNotFound(error)) return undefined;
    throw new ExtractError(`無法讀取${label}：${filePath}（${(error as Error).message}）`);
  }
  try {
    return JSON.parse(raw.replace(/^﻿/, ""));
  } catch (error) {
    throw new ExtractError(`${label}不是合法 JSON：${filePath}（${(error as Error).message}）`);
  }
}
