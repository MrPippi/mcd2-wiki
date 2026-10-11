import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ExtractError } from "../../../scripts/extract/issues";
import { readDataTable } from "../../../scripts/extract/table-reader";

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
    await expect(readDataTable(dir, "DT_X", seen)).resolves.toEqual([{ Name: "a" }]);
    expect(seen).toHaveBeenCalledWith("DT_X.json");
  });

  it("never reads the telemetry constants, whatever the casing, and does not even report them", async () => {
    const dir = await dirWith({ "OnlineConstants.json": '["telemetry-key-0123456789abcdef"]' });
    const seen = vi.fn();
    await expect(readDataTable(dir, "OnlineConstants", seen)).rejects.toThrow(ExtractError);
    await expect(readDataTable(dir, "onlineconstants", seen)).rejects.toThrow(ExtractError);
    expect(seen).not.toHaveBeenCalled();
  });

  it("fails loudly on a missing table or one that is not an array", async () => {
    const dir = await dirWith({ "DT_Obj.json": "{}" });
    await expect(readDataTable(dir, "DT_Missing")).rejects.toThrow(/DT_Missing/);
    await expect(readDataTable(dir, "DT_Obj")).rejects.toThrow(/DT_Obj/);
  });
});
