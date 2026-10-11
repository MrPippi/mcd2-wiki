import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ExtractError } from "../../../scripts/extract/issues";
import { loadMobTables } from "../../../scripts/extract/mob-tables";
import { mobRow } from "../../helpers/mob-tables";

const NAMES = ["DT_MobDefinition", "DT_MobType1Definition", "DT_MobType2Definition", "DT_MobType3Definition", "DT_MobSoulStatedDefinition", "DT_MobVariantDefinition", "DT_AreaDefinition", "DT_SpawnWaveDefinition"];

async function sourceWith(overrides: Record<string, unknown[]>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "mcd2-mobsrc-"));
  const dir = path.join(root, "DataTables", "UFS");
  await mkdir(dir, { recursive: true });
  for (const name of NAMES) await writeFile(path.join(dir, `${name}.json`), JSON.stringify(overrides[name] ?? []), "utf8");
  return root;
}

describe("loadMobTables", () => {
  it("returns undefined when source-data has no mob tables", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "mcd2-empty-"));
    await expect(loadMobTables(root)).resolves.toBeUndefined();
  });

  it("reads the mob, area and wave tables and reports each file it read", async () => {
    const zombie = mobRow("DT_MobType1Definition", "Zombie", "SW.Mob.Zombie", { traits: ["SW.Mob.Type1"], attrs: { Health: 8 } });
    const root = await sourceWith({ DT_MobType1Definition: [zombie] });
    const seen = vi.fn();
    const tables = await loadMobTables(root, seen);
    expect(tables?.type1[0]?.Name).toBe("Zombie");
    expect(tables?.type1[0]?.AttributeValues?.[0]?.Value).toBe(8);
    expect(seen).toHaveBeenCalledWith("DT_SpawnWaveDefinition.json");
    expect(seen.mock.calls.map(([file]) => file)).not.toContain("OnlineConstants.json");
  });

  it("fails with the table name when a field the extractor needs is gone", async () => {
    const root = await sourceWith({ DT_MobType1Definition: [{ Name: "Zombie" }] });
    await expect(loadMobTables(root)).rejects.toThrow(ExtractError);
    await expect(loadMobTables(root)).rejects.toThrow(/TypeTag|type1/);
  });
});
