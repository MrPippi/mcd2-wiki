/** The DataTables the world map reads, validated so a game update that renames a field fails loudly. */
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DATATABLES_DIR } from "./game-tables";
import { ExtractError, formatZodIssue } from "./issues";
import { readJsonFile } from "./read-json";

const Tag = z.object({ TagName: z.string() });
const Vec = z.object({ X: z.number(), Y: z.number(), Z: z.number() });

const RegionRow = z.object({
  Name: z.string(),
  RegionData: z.object({
    FancyMapSizeRatio: z.object({ X: z.number() }),
    Bounds: z.object({ MapDims: z.object({ X: z.number() }), MinPos: Vec, MaxPos: Vec }),
  }),
});
const TeleportRow = z.object({ Name: z.string(), AreaTag: Tag, IdTag: Tag, Type: z.string(), Location: Vec });
const ExplorationRow = z.object({ Name: z.string(), TeleportTag: Tag });
const MerchantRow = z.object({ Name: z.string(), Location: Vec, MerchantName: z.string(), MerchantDescription: z.string(), MarkerType: z.string().optional() });
const AreaRow = z.object({
  Name: z.string(),
  TypeTag: Tag,
  TypeTextData: z.object({ Texts: z.record(z.string(), z.object({ Text: z.string() })) }).optional(),
});

export const MapTablesSchema = z.object({
  regions: z.array(RegionRow),
  teleports: z.array(TeleportRow),
  exploration: z.array(ExplorationRow),
  merchants: z.array(MerchantRow),
  areas: z.array(AreaRow),
});
export type MapTables = z.infer<typeof MapTablesSchema>;
export type TeleportRowValue = z.infer<typeof TeleportRow>;
export type AreaRowValue = z.infer<typeof AreaRow>;

const FILES: Readonly<Record<keyof MapTables, string>> = {
  regions: "DT_WorldRegionMapData",
  teleports: "DT_WorldTeleportPoints",
  exploration: "DT_WorldExplorationTeleportPoints",
  merchants: "DT_MerchantLocationsDefinition",
  areas: "DT_AreaDefinition",
};

/** Reads the map tables; undefined when source-data has no region table (the map is then left empty). */
export async function loadMapTables(sourceRoot: string): Promise<MapTables | undefined> {
  const dir = path.join(sourceRoot, ...DATATABLES_DIR.split("/"));
  if (!existsSync(path.join(dir, `${FILES.regions}.json`))) return undefined;
  const entries = await Promise.all(
    Object.entries(FILES).map(async ([key, name]) => {
      const rows = await readJsonFile(path.join(dir, `${name}.json`), `資料表 ${name}`);
      if (!Array.isArray(rows)) throw new ExtractError(`資料表 ${name} 不存在或不是陣列：${dir}`);
      return [key, rows] as const;
    }),
  );
  const parsed = MapTablesSchema.safeParse(Object.fromEntries(entries));
  if (!parsed.success) {
    throw new ExtractError(`地圖資料表欄位與預期不符（遊戲更新了格式？）：${parsed.error.issues.slice(0, 3).map(formatZodIssue).join("；")}`);
  }
  return parsed.data;
}
