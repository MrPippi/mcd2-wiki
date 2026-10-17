/**
 * The DataTables the drop odds read on top of the loot and item tables (loot-tables.ts): the slot rules, the rarity rows, and
 * the rows that give a tag its parents (loot actors, areas, mobs). Rows are validated so a game update fails loudly.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { RarityRow } from "./drop-rarity-rows";
import type { TaggedRow } from "./drop-slots";
import { DATATABLES_DIR } from "./game-tables";
import { ExtractError, formatZodIssue } from "./issues";
import { loadMobTables } from "./mob-tables";
import { readDataTable } from "./table-reader";

const Tag = z.object({ TagName: z.string() });
const Traits = z.object({ GameplayTags: z.array(Tag).optional() }).optional();
const TaggedRowSchema = z.object({ TypeTag: Tag, Traits });

const SlotRuleSchema = z.object({
  TypeTag: Tag,
  SlotData: z.object({ RecentDropsToTrack: z.number().int().min(0), LootModificationFunctions: z.array(Tag).optional() }),
});
const RarityRowSchema = z.object({
  TypeTag: Tag,
  Traits,
  TagList: z.object({ Tags: z.array(z.object({ TypeTag: Tag, Weight: z.number(), Operation: z.string() })).optional() }),
});
const DifficultySchema = z.object({ Name: z.string(), TypeTag: Tag });

const FILES = {
  slotRules: ["DT_LootSlotDefinition", z.array(SlotRuleSchema)],
  rarityChance: ["DT_RarityChanceDefinition", z.array(RarityRowSchema)],
  actors: ["DT_LootActorDefinition", z.array(TaggedRowSchema)],
  areas: ["DT_AreaDefinition", z.array(TaggedRowSchema)],
  difficulties: ["DT_DifficultyDefinition", z.array(DifficultySchema)],
} as const;

export interface DropTables {
  readonly slotRules: readonly z.infer<typeof SlotRuleSchema>[];
  readonly rarityChance: readonly RarityRow[];
  /** Rows of loot actors, areas and mobs: only their tags and traits, for the tag hierarchy. */
  readonly hierarchy: readonly TaggedRow[];
  readonly difficulties: readonly z.infer<typeof DifficultySchema>[];
  /** Area rows (tag and traits), the contexts of area chests and mobs. */
  readonly areas: readonly TaggedRow[];
}

/** The slot rules the model knows: how many latest drops block their group, and whether the slot never gives an item twice. */
const PREVENT_REPEATING = "SW.LootModificationFunction.PreventRepeatingDrops";
const PREVENT_DUPLICATE = "SW.LootModificationFunction.PreventDuplicateOneOfAKindDrops";

export const slotRuleOf = (row: DropTables["slotRules"][number]): { history: number; oneOfAKind: boolean } => {
  const functions = (row.SlotData.LootModificationFunctions ?? []).map((one) => one.TagName);
  return { history: functions.includes(PREVENT_REPEATING) ? row.SlotData.RecentDropsToTrack : 0, oneOfAKind: functions.includes(PREVENT_DUPLICATE) };
};

export interface LoadedDropTables {
  readonly tables?: DropTables;
  /** The DataTable files that are missing; with any missing, the drop odds are left out. */
  readonly missing: readonly string[];
}

/** Reads the tables; with a table missing from source-data the drop odds are left out and the missing files are named. */
export async function loadDropTables(sourceRoot: string, onRead?: (file: string) => void): Promise<LoadedDropTables> {
  const dir = path.join(sourceRoot, ...DATATABLES_DIR.split("/"));
  const missing = Object.values(FILES).map(([name]) => `${name}.json`).filter((file) => !existsSync(path.join(dir, file)));
  if (missing.length > 0) return { missing };
  const read = async <K extends keyof typeof FILES>(key: K): Promise<z.infer<(typeof FILES)[K][1]>> => {
    const [name, schema] = FILES[key];
    const parsed = schema.safeParse(await readDataTable(dir, name, onRead));
    if (!parsed.success) {
      throw new ExtractError(`資料表 ${name}（${key}）欄位與預期不符（遊戲更新了格式？）：${parsed.error.issues.slice(0, 3).map(formatZodIssue).join("；")}`);
    }
    return parsed.data as z.infer<(typeof FILES)[K][1]>;
  };
  const [slotRules, rarityChance, actors, areas, difficulties, mobs] = await Promise.all([
    read("slotRules"), read("rarityChance"), read("actors"), read("areas"), read("difficulties"), loadMobTables(sourceRoot, onRead),
  ]);
  const mobRows = mobs ? [...mobs.definitions, ...mobs.type1, ...mobs.type2, ...mobs.type3, ...mobs.soulStated, ...mobs.variants] : [];
  return { missing: [], tables: { slotRules, rarityChance, hierarchy: [...actors, ...areas, ...mobRows], difficulties, areas } };
}
