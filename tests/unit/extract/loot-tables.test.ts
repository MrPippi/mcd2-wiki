import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ITEM_TABLE_CATEGORY, loadLootTables } from "../../../scripts/extract/loot-tables";
import { itemRow, lootRow, slot } from "../../helpers/mob-tables";

const NAMES = ["DT_LootSourceDefinition", "DT_LootSourceDefinition_Mob", "DT_LootSourceDefinition_Area", "DT_LootSourceDefinition_LootActor", "DT_LootSourceDefinition_Quest", "DT_ItemDefinitionMelee", "DT_ItemDefinitionRanged", "DT_ItemDefinitionArmor", "DT_ItemDefinitionArtifact", "DT_ItemDefinitionEnchantmentBook", "DT_ItemDefinitionTalisman"];

async function sourceWith(overrides: Record<string, unknown[]>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "mcd2-lootsrc-"));
  const dir = path.join(root, "DataTables", "UFS");
  await mkdir(dir, { recursive: true });
  for (const name of NAMES) await writeFile(path.join(dir, `${name}.json`), JSON.stringify(overrides[name] ?? []), "utf8");
  return root;
}

describe("loadLootTables", () => {
  it("returns undefined without the area loot table", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "mcd2-empty-"));
    await expect(loadLootTables(root)).resolves.toBeUndefined();
  });

  it("reads loot rows with their slots and drops Base* rows from the item tables", async () => {
    const plains = lootRow("PlainsA1", "SW.Area.Plains.A1", [slot("Item", 0, 0, 0, true, ["SW.Item.Sickles"])]);
    const root = await sourceWith({
      DT_LootSourceDefinition_Area: [plains],
      DT_ItemDefinitionEnchantmentBook: [itemRow("DT_ItemDefinitionEnchantmentBook", "BaseEnchanmentBook", "SW.Item.EnchantmentBook.Base"), itemRow("DT_ItemDefinitionEnchantmentBook", "Arcane", "SW.Item.EnchantmentBook.Arcane")],
    });
    const tables = await loadLootTables(root);
    const itemSlot = tables?.area[0]?.LootDropDefinition.LootSlots?.['(TagName="SW.LootSlot.Item")'];
    expect(itemSlot?.InheritParentDropTable).toBe(true);
    expect(itemSlot?.DropTable.Tags?.[0]?.TypeTag.TagName).toBe("SW.Item.Sickles");
    expect(tables?.enchantmentBook.map((row) => row.Name)).toEqual(["Arcane"]);
  });

  it("accepts a loot row with no slots at all", async () => {
    const bare = { Name: "Bare", TypeTag: { TagName: "SW.Area.Bare" }, LootDropDefinition: {} };
    const root = await sourceWith({ DT_LootSourceDefinition_Area: [bare] });
    const tables = await loadLootTables(root);
    expect(tables?.area[0]?.Name).toBe("Bare");
    expect(tables?.area[0]?.LootDropDefinition.LootSlots).toBeUndefined();
  });

  it("maps each item table to its site category", () => {
    expect(ITEM_TABLE_CATEGORY).toEqual({ melee: "melee", ranged: "ranged", armor: "armor", artifact: "artifact", enchantmentBook: "enchantment-book", talisman: "talisman" });
  });
});
