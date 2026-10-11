/** The loot-source and item DataTable fields the bestiary and item sources read, validated so a game update fails loudly. */
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Category } from "./config";
import { DATATABLES_DIR } from "./game-tables";
import { ExtractError, formatZodIssue } from "./issues";
import { readDataTable } from "./table-reader";

const Tag = z.object({ TagName: z.string() });
const Tags = z.object({ GameplayTags: z.array(Tag).optional(), ParentTags: z.array(Tag).optional() }).optional();
const TextData = z.object({ Texts: z.record(z.string(), z.object({ Text: z.string() })) }).optional();

const LootSlotSchema = z.object({
  NumberOfGuaranteedDrops: z.number(),
  NumberOfRandomRolls: z.number(),
  DropChancePerRoll: z.number(),
  InheritParentDropTable: z.boolean(),
  DropTable: z.object({ Tags: z.array(z.object({ TypeTag: Tag, Weight: z.number(), Operation: z.string() })).optional() }),
});
const LootRowSchema = z.object({
  Name: z.string(),
  TypeTag: Tag,
  Traits: Tags,
  // Some real rows (10) have no slots at all.
  LootDropDefinition: z.object({ LootSlots: z.record(z.string(), LootSlotSchema).optional() }),
});
const ItemTagRowSchema = z.object({ Name: z.string(), TypeTag: Tag, Traits: Tags, TypeTextData: TextData });

export const LootTablesSchema = z.object({
  generic: z.array(LootRowSchema),
  mob: z.array(LootRowSchema),
  area: z.array(LootRowSchema),
  lootActor: z.array(LootRowSchema),
  quest: z.array(LootRowSchema),
  melee: z.array(ItemTagRowSchema),
  ranged: z.array(ItemTagRowSchema),
  armor: z.array(ItemTagRowSchema),
  artifact: z.array(ItemTagRowSchema),
  enchantmentBook: z.array(ItemTagRowSchema),
  talisman: z.array(ItemTagRowSchema),
});
export type LootTables = z.infer<typeof LootTablesSchema>;
export type LootRow = LootTables["area"][number];
export type LootSlotValue = z.infer<typeof LootSlotSchema>;
export type ItemTagRow = LootTables["melee"][number];

export const ITEM_TABLE_CATEGORY: Readonly<Record<"melee" | "ranged" | "armor" | "artifact" | "enchantmentBook" | "talisman", Category>> = {
  melee: "melee",
  ranged: "ranged",
  armor: "armor",
  artifact: "artifact",
  enchantmentBook: "enchantment-book",
  talisman: "talisman",
};

const KEYS = ["generic", "mob", "area", "lootActor", "quest", "melee", "ranged", "armor", "artifact", "enchantmentBook", "talisman"] as const;
type Key = (typeof KEYS)[number];
const FILES: Readonly<Record<Key, string>> = {
  generic: "DT_LootSourceDefinition",
  mob: "DT_LootSourceDefinition_Mob",
  area: "DT_LootSourceDefinition_Area",
  lootActor: "DT_LootSourceDefinition_LootActor",
  quest: "DT_LootSourceDefinition_Quest",
  melee: "DT_ItemDefinitionMelee",
  ranged: "DT_ItemDefinitionRanged",
  armor: "DT_ItemDefinitionArmor",
  artifact: "DT_ItemDefinitionArtifact",
  enchantmentBook: "DT_ItemDefinitionEnchantmentBook",
  talisman: "DT_ItemDefinitionTalisman",
};
const ITEM_KEYS: readonly Key[] = ["melee", "ranged", "armor", "artifact", "enchantmentBook", "talisman"];

const isTemplateRow = (row: unknown): boolean =>
  typeof row === "object" && row !== null && "Name" in row && /^Base[A-Z]/.test(String(row.Name));

/** Reads the loot tables; undefined when source-data has no loot DataTables (item sources are then left out). */
export async function loadLootTables(sourceRoot: string, onRead?: (file: string) => void): Promise<LootTables | undefined> {
  const dir = path.join(sourceRoot, ...DATATABLES_DIR.split("/"));
  if (!existsSync(path.join(dir, `${FILES.area}.json`))) return undefined;
  const entries = await Promise.all(
    KEYS.map(async (key) => {
      const all = await readDataTable(dir, FILES[key], onRead);
      // Base* rows (BaseMeleeWeapon, BaseEnchanmentBook…) are templates other rows inherit from, not items.
      const rows = ITEM_KEYS.includes(key) ? all.filter((row) => !isTemplateRow(row)) : all;
      const parsed = LootTablesSchema.shape[key].safeParse(rows);
      if (!parsed.success) {
        throw new ExtractError(`資料表 ${FILES[key]}（${key}）欄位與預期不符（遊戲更新了格式？）：${parsed.error.issues.slice(0, 3).map(formatZodIssue).join("；")}`);
      }
      return [key, parsed.data] as const;
    }),
  );
  return LootTablesSchema.parse(Object.fromEntries(entries));
}
