import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
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
  it("reads the zh-Hant and en culture files", async () => {
    await write("Localization/All/en/All.json", JSON.stringify({ N: { K: "Sword" } }));
    await write("Localization/All/zh-Hant/All.json", JSON.stringify({ N: { K: "劍" } }));
    await expect(loadLocales(dir)).resolves.toEqual({
      en: { N: { K: "Sword" } },
      zh: { N: { K: "劍" } },
    });
  });
});
