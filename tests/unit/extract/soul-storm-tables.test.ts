import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadSoulStormTables, SOUL_STORM_TABLE_FILES } from "../../../scripts/extract/soul-storm-tables";
import { realSoulStormTables, REAL_CHESTS, REAL_GENERATORS, REAL_SPAWNS, rotationRow, scheduleRow } from "../../helpers/soul-storm-tables";

async function sourceWith(tables: Record<string, unknown>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "mcd2-storm-"));
  const dir = path.join(root, "DataTables", "UFS");
  await mkdir(dir, { recursive: true });
  for (const [name, rows] of Object.entries(tables)) await writeFile(path.join(dir, `${name}.json`), JSON.stringify(rows), "utf8");
  return root;
}

describe("Soul Storm tables", () => {
  it("accepts the game's row shapes", () => {
    const tables = realSoulStormTables();
    expect(tables.schedule[0].CadenceInSeconds).toBe(2400);
    expect(tables.rotation[0].AreaTags.map((area) => area.TagName)).toHaveLength(7);
    expect(tables.props).toHaveLength(5);
  });

  it("loads every table through the reader and reports what it read", async () => {
    const root = await sourceWith({
      DT_SoulStormTimeSchedule: [scheduleRow()], DT_SoulStormScheduleAreaRotation: [rotationRow()],
      DT_SoulStormPropActorDefinition: REAL_GENERATORS(), DT_SpawnDefinition: REAL_SPAWNS(), DT_LootSourceDefinition_LootActor: REAL_CHESTS(),
      DT_RarityChanceDefinition: [], DT_GameBalanceDefinition: [],
    });
    const read: string[] = [];
    const loaded = await loadSoulStormTables(root, (file) => read.push(file));
    expect(loaded.missing).toEqual([]);
    expect(loaded.tables?.schedule[0].Timestamp).toBe("2026.01.01-00.00.00");
    expect(read.sort()).toEqual(Object.values(SOUL_STORM_TABLE_FILES).map((name) => `${name}.json`).sort());
    expect(read.some((file) => /constants/i.test(file))).toBe(false);
  });

  it("has no tables without the schedule, and names what is missing", async () => {
    const root = await sourceWith({ DT_SoulStormScheduleAreaRotation: [rotationRow()] });
    const loaded = await loadSoulStormTables(root);
    expect(loaded.tables).toBeUndefined();
    expect(loaded.missing).toContain("DT_SoulStormTimeSchedule.json");
  });

  it("keeps going with empty optional tables", async () => {
    const root = await sourceWith({ DT_SoulStormTimeSchedule: [scheduleRow()], DT_SoulStormScheduleAreaRotation: [rotationRow()] });
    const loaded = await loadSoulStormTables(root);
    expect(loaded.tables?.props).toEqual([]);
    expect(loaded.missing).toEqual(expect.arrayContaining(["DT_SoulStormPropActorDefinition.json", "DT_SpawnDefinition.json"]));
  });

  it("fails with the file name when a row does not match", async () => {
    const root = await sourceWith({ DT_SoulStormTimeSchedule: [{ ...scheduleRow(), CadenceInSeconds: "2400" }], DT_SoulStormScheduleAreaRotation: [rotationRow()] });
    await expect(loadSoulStormTables(root)).rejects.toThrow(/DT_SoulStormTimeSchedule/);
  });
});
