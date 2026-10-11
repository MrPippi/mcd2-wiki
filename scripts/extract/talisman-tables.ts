/** The talisman DataTables, validated so a game update that renames a field fails loudly. */
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DATATABLES_DIR } from "./game-tables";
import { ExtractError, formatZodIssue } from "./issues";
import { readJsonFile } from "./read-json";

const Tag = z.object({ TagName: z.string() });
const Tags = z.object({ GameplayTags: z.array(Tag).optional() }).optional();
const TextData = z.object({ Texts: z.record(z.string(), z.object({ Text: z.string() })) }).optional();
const KeyValue = z.object({ TypeTag: Tag, Float: z.number().optional(), Int: z.number().optional() });
const CompanionLevel = z.object({ AttackMultiplier: z.number(), DefenceMultiplier: z.number(), CooldownMultiplier: z.number() }).optional();

const ItemRow = z.object({
  Name: z.string(),
  TypeTag: Tag,
  TypeTextData: TextData,
  /** Companion talismans spawn a pet through an ability whose instance data scales it per talisman level. */
  GrantedAbilities: z
    .array(
      z.object({
        CommonKeyValues: z.array(KeyValue).optional(),
        InstanceData: z.array(z.object({ LevelOne: CompanionLevel, LevelTwo: CompanionLevel, LevelThree: CompanionLevel })).optional(),
      }),
    )
    .optional(),
});
const PropertyRow = z.object({
  Name: z.string(),
  TypeTag: Tag,
  ItemLevels: z
    .object({ Levels: z.array(z.object({ Level: Tag, XPRequiredForNextLevel: z.number(), Effects: Tags })).optional() })
    .optional(),
});
const TemplateRow = z.object({
  Name: z.string(),
  TypeTag: Tag,
  TemplateData: z.object({
    Effect: Tag.optional(),
    HasFixedEffectValue: z.boolean().optional(),
    FixedEffectValue: z.number().optional(),
  }),
});
const CollectionRow = z.object({ Name: z.string(), CollectionDefinition: z.object({ ItemsInCollection: Tags }).optional() });

export const TalismanTablesSchema = z.object({
  items: z.array(ItemRow),
  properties: z.array(PropertyRow),
  templates: z.array(TemplateRow),
  collections: z.array(CollectionRow),
});
export type TalismanTables = z.infer<typeof TalismanTablesSchema>;
export type TalismanItemRow = z.infer<typeof ItemRow>;
export type TalismanPropertyRow = z.infer<typeof PropertyRow>;

const FILES: Readonly<Record<keyof TalismanTables, string>> = {
  items: "DT_ItemDefinitionTalisman",
  properties: "DT_TalismanPropertyDefinition",
  templates: "DT_TalismanEffectTemplateDefinition",
  collections: "DT_ItemCollectionsDefinition",
};
/** Collections only add the secret-talisman mark, so the site builds without that table. */
const OPTIONAL: ReadonlySet<keyof TalismanTables> = new Set(["collections"]);
const BASE_ROW = /^Base[A-Z]/;

async function readRows(dir: string, key: keyof TalismanTables): Promise<unknown[]> {
  const name = FILES[key];
  const rows = await readJsonFile(path.join(dir, `${name}.json`), `資料表 ${name}`);
  if (rows === undefined && OPTIONAL.has(key)) return [];
  if (!Array.isArray(rows)) throw new ExtractError(`資料表 ${name} 不存在或不是陣列：${dir}`);
  return rows.filter((row: { Name?: unknown }) => !BASE_ROW.test(String(row?.Name ?? "")));
}

/** Reads the talisman tables; undefined when source-data has no talisman property table (talisman values are then left out). */
export async function loadTalismanTables(sourceRoot: string): Promise<TalismanTables | undefined> {
  const dir = path.join(sourceRoot, ...DATATABLES_DIR.split("/"));
  if (!existsSync(path.join(dir, `${FILES.properties}.json`))) return undefined;
  const keys = Object.keys(FILES).filter((key): key is keyof TalismanTables => key in FILES);
  const raw = Object.fromEntries(await Promise.all(keys.map(async (key) => [key, await readRows(dir, key)] as const)));
  const parsed = TalismanTablesSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ExtractError(`護符資料表欄位與預期不符（遊戲更新了格式？）：${parsed.error.issues.slice(0, 3).map(formatZodIssue).join("；")}`);
  }
  return parsed.data;
}
