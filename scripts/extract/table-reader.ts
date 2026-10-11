/** The only way extract code reads a DataTable. It refuses the telemetry constants, which hold a live API key. */
import path from "node:path";
import { ExtractError } from "./issues";
import { readJsonFile } from "./read-json";

/** Table names (case-insensitive substrings) that must never be read or published. */
export const FORBIDDEN_TABLES: readonly string[] = ["OnlineConstants"];

export async function readDataTable(dir: string, name: string, onRead?: (file: string) => void): Promise<unknown[]> {
  const lowered = name.toLowerCase();
  if (FORBIDDEN_TABLES.some((forbidden) => lowered.includes(forbidden.toLowerCase()))) {
    throw new ExtractError(`資料表 ${name} 禁止讀取（含遙測金鑰）`);
  }
  const file = `${name}.json`;
  const rows = await readJsonFile(path.join(dir, file), `資料表 ${name}`);
  if (!Array.isArray(rows)) throw new ExtractError(`資料表 ${name} 不存在或不是陣列：${dir}`);
  onRead?.(file);
  return rows;
}
