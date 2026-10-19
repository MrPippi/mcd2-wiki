import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { ALL_LANGS, LANG_META } from "../../../shared/config";
import { ExtractError } from "../../../scripts/extract/issues";
import { loadLocaleFile, loadLocales } from "../../../scripts/extract/parse-locale";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "mcd2-locale-"));
});

async function write(relative: string, content: string): Promise<string> {
  const file = path.join(dir, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
  return file;
}

describe("loadLocaleFile", () => {
  it("returns namespaces mapped to key/text records", async () => {
    const file = await write("All.json", JSON.stringify({ "Text/Release/A.csv": { K: "v" } }));
    await expect(loadLocaleFile(file)).resolves.toEqual({ "Text/Release/A.csv": { K: "v" } });
  });

  it("strips a UTF-8 BOM", async () => {
    const file = await write("All.json", `﻿${JSON.stringify({ N: { K: "v" } })}`);
    await expect(loadLocaleFile(file)).resolves.toEqual({ N: { K: "v" } });
  });

  it("fails with the path when the file is missing", async () => {
    const file = path.join(dir, "missing.json");
    await expect(loadLocaleFile(file)).rejects.toThrow(ExtractError);
    await expect(loadLocaleFile(file)).rejects.toThrow(`找不到語系檔：${file}`);
  });

  it("fails on invalid JSON", async () => {
    const file = await write("All.json", "{ nope");
    await expect(loadLocaleFile(file)).rejects.toThrow("語系檔不是合法 JSON");
  });

  it("fails with the offending key path when a value is not a string", async () => {
    const file = await write("All.json", JSON.stringify({ N: { K: 1 } }));
    await expect(loadLocaleFile(file)).rejects.toThrow(/語系檔格式錯誤：.*N › K/);
  });
});

describe("loadLocales", () => {
  const writeAll = () =>
    Promise.all(ALL_LANGS.map((lang) => write(`Localization/All/${LANG_META[lang].culture}/All.json`, JSON.stringify({ N: { K: `${lang}:Sword` } }))));

  it("reads every language's culture file", async () => {
    await writeAll();
    const locales = await loadLocales(dir);
    expect(Object.keys(locales)).toEqual([...ALL_LANGS]);
    expect(locales.zh).toEqual({ N: { K: "zh:Sword" } });
    expect(locales["zh-hans"]).toEqual({ N: { K: "zh-hans:Sword" } });
    expect(locales.pt).toEqual({ N: { K: "pt:Sword" } });
  });

  it("fails naming the file of a missing language", async () => {
    await writeAll();
    await rm(path.join(dir, "Localization", "All", "ru-RU", "All.json"));
    await expect(loadLocales(dir)).rejects.toThrow(/找不到語系檔：.*ru-RU/);
  });
});
