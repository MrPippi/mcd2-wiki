import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { loadDropTables, slotRuleOf } from "../../../scripts/extract/drop-tables";
import { ExtractError } from "../../../scripts/extract/issues";

const NAMES = ["DT_LootSlotDefinition", "DT_RarityChanceDefinition", "DT_LootActorDefinition", "DT_AreaDefinition", "DT_DifficultyDefinition"];
const MOB_NAMES = ["DT_MobDefinition", "DT_MobType1Definition", "DT_MobType2Definition", "DT_MobType3Definition", "DT_MobSoulStatedDefinition", "DT_MobVariantDefinition", "DT_SpawnWaveDefinition"];
const tag = (TagName: string) => ({ TagName });

async function sourceWith(rows: Record<string, unknown[]>, names: readonly string[] = [...NAMES, ...MOB_NAMES]): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "mcd2-dropsrc-"));
  const dir = path.join(root, "DataTables", "UFS");
  await mkdir(dir, { recursive: true });
  for (const name of names) await writeFile(path.join(dir, `${name}.json`), JSON.stringify(rows[name] ?? []), "utf8");
  return root;
}

describe("loadDropTables", () => {
  it("names the missing files and reads nothing when a table is absent", async () => {
    const root = await sourceWith({}, NAMES.slice(0, 3));
    const loaded = await loadDropTables(root);
    expect(loaded.tables).toBeUndefined();
    expect(loaded.missing).toEqual(["DT_AreaDefinition.json", "DT_DifficultyDefinition.json"]);
  });

  it("reads the slot, rarity, hierarchy and difficulty rows, and reports each file it read", async () => {
    const root = await sourceWith({
      DT_LootSlotDefinition: [{ TypeTag: tag("SW.LootSlot.Item"), SlotData: { RecentDropsToTrack: 3 } }],
      DT_RarityChanceDefinition: [{ TypeTag: tag("SW.Player"), TagList: {} }],
      DT_LootActorDefinition: [{ TypeTag: tag("SW.LootActor.A"), Traits: { GameplayTags: [tag("SW.LootActor.B")] } }],
      DT_AreaDefinition: [{ Name: "A", TypeTag: tag("SW.Area.A") }],
      DT_DifficultyDefinition: [{ Name: "Normal", TypeTag: tag("SW.Difficulty.Normal") }],
      DT_MobType1Definition: [{ Name: "Zombie", TypeTag: tag("SW.Mob.Zombie"), Traits: { GameplayTags: [tag("SW.Mob.Default.Hostile")] } }],
    });
    const seen = vi.fn();
    const loaded = await loadDropTables(root, seen);
    expect(loaded.missing).toEqual([]);
    expect(loaded.tables?.slotRules).toHaveLength(1);
    expect(loaded.tables?.hierarchy.map((row) => row.TypeTag.TagName)).toEqual(["SW.LootActor.A", "SW.Area.A", "SW.Mob.Zombie"]);
    expect(loaded.tables?.difficulties[0].Name).toBe("Normal");
    expect(seen).toHaveBeenCalledWith("DT_RarityChanceDefinition.json");
  });

  it("fails with the table name when a field the extractor needs is gone", async () => {
    const root = await sourceWith({ DT_LootSlotDefinition: [{ TypeTag: tag("SW.LootSlot.Item") }] });
    await expect(loadDropTables(root)).rejects.toThrow(ExtractError);
    await expect(loadDropTables(root)).rejects.toThrow(/DT_LootSlotDefinition/);
  });
});

describe("slotRuleOf", () => {
  const rule = (recent: number, ...functions: string[]) =>
    slotRuleOf({ TypeTag: tag("SW.LootSlot.X"), SlotData: { RecentDropsToTrack: recent, LootModificationFunctions: functions.map((name) => tag(`SW.LootModificationFunction.${name}`)) } });

  it("tracks the latest drops only for a slot that prevents repeats", () => {
    expect(rule(3, "PreventRepeatingDrops")).toEqual({ history: 3, oneOfAKind: false });
    expect(rule(4, "PreventDuplicateOneOfAKindDrops")).toEqual({ history: 0, oneOfAKind: true });
    expect(rule(4, "PreventRepeatingDrops", "PreventDuplicateOneOfAKindDrops")).toEqual({ history: 4, oneOfAKind: true });
  });

  it("has no rule for a slot with no modification function", () => {
    expect(rule(0)).toEqual({ history: 0, oneOfAKind: false });
  });
});
