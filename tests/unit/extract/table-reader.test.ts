import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ExtractError } from "../../../scripts/extract/issues";
import { readDataTable, readTableFile } from "../../../scripts/extract/table-reader";

async function dirWith(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "mcd2-tables-"));
  await mkdir(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) await writeFile(path.join(dir, name), content, "utf8");
  return dir;
}

describe("readDataTable", () => {
  it("reads a table and reports the file it read", async () => {
    const dir = await dirWith({ "DT_X.json": '[{"Name":"a"}]' });
    const seen = vi.fn();
    await expect(readDataTable(dir, "DT_X", { onRead: seen })).resolves.toEqual([{ Name: "a" }]);
    expect(seen).toHaveBeenCalledWith("DT_X.json");
  });

  it("never reads the telemetry constants, whatever the casing, and does not even report them", async () => {
    const dir = await dirWith({ "OnlineConstants.json": '["telemetry-key-0123456789abcdef"]' });
    const seen = vi.fn();
    await expect(readDataTable(dir, "OnlineConstants", { onRead: seen })).rejects.toThrow(ExtractError);
    await expect(readDataTable(dir, "onlineconstants", { onRead: seen })).rejects.toThrow(ExtractError);
    expect(seen).not.toHaveBeenCalled();
  });

  it("fails loudly on a missing table or one that is not an array", async () => {
    const dir = await dirWith({ "DT_Obj.json": "{}" });
    await expect(readDataTable(dir, "DT_Missing")).rejects.toThrow(/DT_Missing/);
    await expect(readDataTable(dir, "DT_Obj")).rejects.toThrow(/DT_Obj/);
  });
  it("reads a missing table as no rows when optional, but still fails on a non-array one", async () => {
    const dir = await dirWith({ "DT_Obj.json": "{}" });
    const seen = vi.fn();
    await expect(readDataTable(dir, "DT_Missing", { optional: true, onRead: seen })).resolves.toEqual([]);
    expect(seen).not.toHaveBeenCalled();
    await expect(readDataTable(dir, "DT_Obj", { optional: true })).rejects.toThrow(/DT_Obj/);
  });

  it("drops Base* template rows only when asked", async () => {
    const dir = await dirWith({ "DT_B.json": '[{"Name":"BaseMelee"},{"Name":"Basement"},{"Name":"Sword"},{}]' });
    await expect(readDataTable(dir, "DT_B", { dropBase: true })).resolves.toEqual([{ Name: "Basement" }, { Name: "Sword" }, {}]);
    await expect(readDataTable(dir, "DT_B")).resolves.toHaveLength(4);
  });
});

describe("readTableFile", () => {
  it("returns the raw JSON, or undefined when the file is absent", async () => {
    const dir = await dirWith({ "CT_A.json": '[{"Rows":{}}]' });
    await expect(readTableFile(path.join(dir, "CT_A.json"), "曲線表")).resolves.toEqual([{ Rows: {} }]);
    await expect(readTableFile(path.join(dir, "CT_B.json"), "曲線表")).resolves.toBeUndefined();
  });

  it("refuses the telemetry constants by file name", async () => {
    const dir = await dirWith({ "OnlineConstants.json": '["telemetry-key-0123456789abcdef"]' });
    await expect(readTableFile(path.join(dir, "OnlineConstants.json"), "資料表")).rejects.toThrow(ExtractError);
  });
});

describe("extract source", () => {
  it("lets only table-reader and the non-table loaders import read-json, so no DataTable read can skip the guard", async () => {
    const root = path.join(__dirname, "../../../scripts/extract");
    const allowed = new Set(["table-reader.ts", "achievements.ts", "guides.ts", "icon-files.ts", "map-spots.ts", "parse-locale.ts", "soul-storm.ts"]);
    const files = (await readdir(root, { recursive: true })).filter((file) => file.endsWith(".ts"));
    const importers: string[] = [];
    for (const file of files) if ((await readFile(path.join(root, file), "utf8")).includes('"./read-json"')) importers.push(file);
    expect(importers.filter((file) => !allowed.has(file))).toEqual([]);
  });
});
