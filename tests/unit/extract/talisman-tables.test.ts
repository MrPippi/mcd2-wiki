import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadTalismanTables } from "../../../scripts/extract/talisman-tables";
import { ExtractError } from "../../../scripts/extract/issues";
import { TALISMAN_TABLES } from "../../helpers/talisman-tables";

let root: string;
const put = async (name: string, rows: unknown) => {
  const dir = path.join(root, "DataTables", "UFS");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${name}.json`), JSON.stringify(rows), "utf8");
};

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "mcd2-talisman-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("loadTalismanTables", () => {
  it("is undefined when source-data has no talisman property table", async () => {
    expect(await loadTalismanTables(root)).toBeUndefined();
  });

  it("reads the four tables, dropping Base* template rows; a missing collections table is empty", async () => {
    await put("DT_ItemDefinitionTalisman", TALISMAN_TABLES.items);
    await put("DT_TalismanPropertyDefinition", [{ Name: "BaseTalisman", TypeTag: { TagName: "SW.Item.Property.Talisman" }, ItemLevels: {} }, ...TALISMAN_TABLES.properties]);
    await put("DT_TalismanEffectTemplateDefinition", TALISMAN_TABLES.templates);
    const tables = await loadTalismanTables(root);
    expect(tables?.items).toHaveLength(TALISMAN_TABLES.items.length);
    expect(tables?.properties.map((row) => row.Name)).not.toContain("BaseTalisman");
    expect(tables?.templates).toHaveLength(TALISMAN_TABLES.templates.length);
    expect(tables?.collections).toEqual([]);
  });

  it("fails loudly when a table changed shape", async () => {
    await put("DT_ItemDefinitionTalisman", [{ Name: "X" }]);
    await put("DT_TalismanPropertyDefinition", []);
    await put("DT_TalismanEffectTemplateDefinition", []);
    await expect(loadTalismanTables(root)).rejects.toThrow(ExtractError);
  });

  it("fails when a required table is missing", async () => {
    await put("DT_TalismanPropertyDefinition", []);
    await expect(loadTalismanTables(root)).rejects.toThrow(ExtractError);
  });
});
