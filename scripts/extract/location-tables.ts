/** The DataTable fields the location pages read: area rows (name, icon, progression) and the progression levels. */
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DATATABLES_DIR } from "./game-tables";
import { ExtractError, formatZodIssue, issue, type Issue } from "./issues";
import { readDataTable } from "./table-reader";

export const LOCATION_TABLE_FILES = { areas: "DT_AreaDefinition", progression: "DT_ProgressionDefinition" } as const;

const Tag = z.looseObject({ TagName: z.string() });
const AreaRowSchema = z.looseObject({
  Name: z.string(),
  TypeTag: Tag,
  TypeTextData: z.looseObject({ Texts: z.record(z.string(), z.looseObject({ Text: z.string() })) }).optional(),
  AreaIcon: z.string().optional(),
  AreaDefinition: z.looseObject({ ProgressionDefinition: Tag.optional() }).optional(),
});
const ProgressionRowSchema = z.looseObject({
  TypeTag: Tag,
  ProgressionData: z.looseObject({ PlayerLevel: z.number() }).optional(),
});

const TablesSchema = z.object({ areas: z.array(AreaRowSchema), progression: z.array(ProgressionRowSchema) });
export type LocationTables = z.infer<typeof TablesSchema>;
export type LocationAreaRow = LocationTables["areas"][number];
export type ProgressionRow = LocationTables["progression"][number];

const KEYS = ["areas", "progression"] as const;

export interface LoadedLocationTables {
  readonly tables?: LocationTables;
  readonly issues: Issue[];
}

/** Reads the area and progression tables; `tables` is undefined (and reported) when the area table is missing. */
export async function loadLocationTables(sourceRoot: string, onRead?: (file: string) => void): Promise<LoadedLocationTables> {
  const dir = path.join(sourceRoot, ...DATATABLES_DIR.split("/"));
  const present = (key: (typeof KEYS)[number]): boolean => existsSync(path.join(dir, `${LOCATION_TABLE_FILES[key]}.json`));
  if (!present("areas")) return { issues: [issue("missing-location-tables", `${LOCATION_TABLE_FILES.areas}.json`)] };
  const rows = await Promise.all(KEYS.map((key) => (present(key) ? readDataTable(dir, LOCATION_TABLE_FILES[key], onRead) : Promise.resolve([]))));
  const parsed = TablesSchema.safeParse({ areas: rows[0], progression: rows[1] });
  if (!parsed.success) {
    throw new ExtractError(`地區資料表欄位與預期不符（遊戲更新了格式？）：${parsed.error.issues.slice(0, 2).map(formatZodIssue).join("；")}`);
  }
  return {
    tables: parsed.data,
    issues: present("progression") ? [] : [issue("missing-location-tables", `${LOCATION_TABLE_FILES.progression}.json`)],
  };
}
