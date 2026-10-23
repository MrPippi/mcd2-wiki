/** The soul enchantment fields the extractor reads, plus the mob and wave rows that exclude families; validated so a game update fails loudly. */
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DATATABLES_DIR } from "./game-tables";
import { ExtractError, formatZodIssue } from "./issues";
import { readDataTable } from "./table-reader";

export const SOUL_ENCHANTMENT_TABLE_FILES = {
  enchantments: "DT_SoulEnchantmentDefinition",
  soulStated: "DT_MobSoulStatedDefinition",
  variants: "DT_MobVariantDefinition",
  waves: "DT_SpawnWaveDefinition",
} as const;

const Tag = z.looseObject({ TagName: z.string() });
const TagList = z.looseObject({ GameplayTags: z.array(Tag).optional() });
const KeyValue = z.looseObject({
  TypeTag: Tag,
  Type: z.string(),
  Float: z.number().optional(),
  Int: z.number().optional(),
});
const Modifier = z.looseObject({
  Attribute: z.looseObject({ AttributeName: z.string() }),
  ModifierOp: z.string(),
  ModifierMagnitude: z.looseObject({
    MagnitudeCalculationType: z.string(),
    ScalableFloatMagnitude: z.looseObject({ Value: z.number() }).optional(),
  }),
});
const Ability = z.looseObject({
  Ability: z.string(),
  SpecificKeyValues: z.array(KeyValue).optional(),
  CommonKeyValues: z.array(KeyValue).optional(),
});
const Specialization = z.looseObject({
  Ability: z.string(),
  KeyValueSpecializations: z.array(z.looseObject({ KeyValue, ModOp: z.string() })).optional(),
});
const TextData = z.looseObject({ Texts: z.record(z.string(), z.looseObject({ Text: z.string() })) }).optional();

export const SoulEnchantmentRowSchema = z.looseObject({
  Name: z.string(),
  TypeTag: Tag,
  Traits: TagList.optional(),
  GameplayEffect: z.looseObject({ Modifiers: z.array(Modifier).optional() }).optional(),
  Abilities: z.array(Ability).optional(),
  AbilitySpecialization: z.looseObject({ Specializations: z.array(Specialization).optional() }).optional(),
  ThreatLevelSettings: z.looseObject({ MinimumThreatLevel: z.number(), MaximumThreatLevel: z.number() }),
  TypeTextData: TextData,
  IconReference: z.string().optional(),
});
export type SoulEnchantmentRow = z.infer<typeof SoulEnchantmentRowSchema>;
export type SoulAbilityRow = z.infer<typeof Ability>;
export type SoulKeyValue = z.infer<typeof KeyValue>;

/** A mob row: its tags (for the trait closure) and the families it excludes. */
export const ExcluderRowSchema = z.looseObject({
  Name: z.string(),
  TypeTag: Tag,
  Traits: TagList.optional(),
  MobConditions: z.looseObject({ ExcludedSoulEnchantments: TagList.optional() }).optional(),
});
export type ExcluderRow = z.infer<typeof ExcluderRowSchema>;

export const ExcludingWaveRowSchema = z.looseObject({
  Name: z.string(),
  TypeTag: Tag,
  SpawnWaveDefinition: z.looseObject({ ExcludedSoulEnchantmentsOverride: TagList.optional() }).optional(),
});
export type ExcludingWaveRow = z.infer<typeof ExcludingWaveRowSchema>;

export interface SoulEnchantmentTables {
  readonly enchantments: readonly SoulEnchantmentRow[];
  readonly soulStated: readonly ExcluderRow[];
  readonly variants: readonly ExcluderRow[];
  readonly waves: readonly ExcludingWaveRow[];
}

function parseRows<Schema extends z.ZodType>(schema: Schema, rows: unknown[], name: string): z.infer<Schema>[] {
  const parsed = z.array(schema).safeParse(rows);
  if (!parsed.success) throw new ExtractError(`資料表 ${name} 格式不符：${formatZodIssue(parsed.error.issues[0])}`);
  return parsed.data;
}

/** The four tables; undefined (with the missing names) when the soul enchantment table is absent. The mob tables are optional. */
export async function loadSoulEnchantmentTables(
  sourceRoot: string,
  onRead?: (file: string) => void,
): Promise<{ tables?: SoulEnchantmentTables; missing: string[] }> {
  const dir = path.join(sourceRoot, ...DATATABLES_DIR.split("/"));
  const files = SOUL_ENCHANTMENT_TABLE_FILES;
  if (!existsSync(path.join(dir, `${files.enchantments}.json`))) return { missing: [files.enchantments] };
  const read = (name: string): Promise<unknown[]> => readDataTable(dir, name, { onRead, optional: true });
  const [enchantments, soulStated, variants, waves] = await Promise.all([files.enchantments, files.soulStated, files.variants, files.waves].map(read));
  return {
    tables: {
      enchantments: parseRows(SoulEnchantmentRowSchema, enchantments, files.enchantments),
      soulStated: parseRows(ExcluderRowSchema, soulStated, files.soulStated),
      variants: parseRows(ExcluderRowSchema, variants, files.variants),
      waves: parseRows(ExcludingWaveRowSchema, waves, files.waves),
    },
    missing: [],
  };
}
