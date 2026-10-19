/** The mob, area and spawn-wave DataTable fields the bestiary reads, validated so a game update that renames them fails loudly. */
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DATATABLES_DIR } from "./game-tables";
import { ExtractError, formatZodIssue } from "./issues";
import { readDataTable } from "./table-reader";

const Tag = z.object({ TagName: z.string() });
const Tags = z.object({ GameplayTags: z.array(Tag).optional(), ParentTags: z.array(Tag).optional() }).optional();
const TextData = z.object({ Texts: z.record(z.string(), z.object({ Text: z.string() })) }).optional();

const MobRowSchema = z.object({
  Name: z.string(),
  TypeTag: Tag,
  Traits: Tags,
  CharacterReference: z.string().optional(),
  AttributeValues: z.array(z.object({ Attribute: Tag, Value: z.number() })).optional(),
  TypeTextData: TextData,
  Variants: z.object({ Replacements: z.array(z.object({ TypeTagToUseInstead: Tag, Weight: z.number() })).optional() }).optional(),
});
const AreaRowSchema = z.object({
  Name: z.string(),
  TypeTag: Tag,
  TypeTextData: TextData,
  AreaDefinition: z
    .object({
      ConditionGroups: z
        .array(z.object({ DefaultDefinition: z.object({ MobTypes: z.array(z.object({ MobType: Tag })).optional() }).optional() }))
        .optional(),
    })
    .optional(),
});
const WaveRowSchema = z.object({
  Name: z.string(),
  SpawnWaveDefinition: z
    .object({ Waves: z.array(z.object({ Waves: z.array(z.object({ MobType: Tag })).optional() })).optional() })
    .optional(),
});

export const MobTablesSchema = z.object({
  definitions: z.array(MobRowSchema),
  type1: z.array(MobRowSchema),
  type2: z.array(MobRowSchema),
  type3: z.array(MobRowSchema),
  soulStated: z.array(MobRowSchema),
  variants: z.array(MobRowSchema),
  areas: z.array(AreaRowSchema),
  waves: z.array(WaveRowSchema),
});
export type MobTables = z.infer<typeof MobTablesSchema>;
export type MobRow = MobTables["type1"][number];
export type AreaRow = MobTables["areas"][number];
export type WaveRow = MobTables["waves"][number];

const KEYS = ["definitions", "type1", "type2", "type3", "soulStated", "variants", "areas", "waves"] as const;
const FILES: Readonly<Record<(typeof KEYS)[number], string>> = {
  definitions: "DT_MobDefinition",
  type1: "DT_MobType1Definition",
  type2: "DT_MobType2Definition",
  type3: "DT_MobType3Definition",
  soulStated: "DT_MobSoulStatedDefinition",
  variants: "DT_MobVariantDefinition",
  areas: "DT_AreaDefinition",
  waves: "DT_SpawnWaveDefinition",
};

/** Reads the mob tables; undefined when source-data has no mob DataTables (the bestiary is then left out). */
export async function loadMobTables(sourceRoot: string, onRead?: (file: string) => void): Promise<MobTables | undefined> {
  const dir = path.join(sourceRoot, ...DATATABLES_DIR.split("/"));
  if (!existsSync(path.join(dir, `${FILES.type1}.json`))) return undefined;
  const entries = await Promise.all(
    KEYS.map(async (key) => {
      const rows = await readDataTable(dir, FILES[key], { onRead });
      const parsed = MobTablesSchema.shape[key].safeParse(rows);
      if (!parsed.success) {
        throw new ExtractError(`資料表 ${FILES[key]}（${key}）欄位與預期不符（遊戲更新了格式？）：${parsed.error.issues.slice(0, 3).map(formatZodIssue).join("；")}`);
      }
      return [key, parsed.data] as const;
    }),
  );
  return MobTablesSchema.parse(Object.fromEntries(entries));
}
