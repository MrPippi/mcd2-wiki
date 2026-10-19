/** The only way extract code reads a DataTable or CurveTable. It refuses the telemetry constants, which hold a live API key. */
import path from "node:path";
import { ExtractError } from "./issues";
import { readJsonFile } from "./read-json";

/** Table names (case-insensitive substrings) that must never be read or published. */
export const FORBIDDEN_TABLES: readonly string[] = ["OnlineConstants"];

export interface ReadOptions {
  /** Called with `<name>.json` once the table is read. */
  readonly onRead?: (file: string) => void;
  /** A missing file reads as no rows instead of failing. */
  readonly optional?: boolean;
  /** Drops the Base* rows (BaseMeleeWeapon, BaseRanged…): templates other rows inherit from, not items. */
  readonly dropBase?: boolean;
}

const BASE_ROW = /^Base[A-Z]/;

function assertReadable(name: string): void {
  const lowered = name.toLowerCase();
  if (FORBIDDEN_TABLES.some((forbidden) => lowered.includes(forbidden.toLowerCase()))) {
    throw new ExtractError(`資料表 ${name} 禁止讀取（含遙測金鑰）`);
  }
}

/** One table file's parsed JSON, whatever its shape; undefined when the file is absent. For tables the caller validates itself. */
export async function readTableFile(file: string, label: string): Promise<unknown | undefined> {
  assertReadable(path.basename(file));
  return readJsonFile(file, label);
}

/** The rows of `<dir>/<name>.json`; a missing or non-array table fails unless `optional`. */
export async function readDataTable(dir: string, name: string, options: ReadOptions = {}): Promise<unknown[]> {
  assertReadable(name);
  const file = `${name}.json`;
  const rows = await readJsonFile(path.join(dir, file), `資料表 ${name}`);
  if (rows === undefined && options.optional) return [];
  if (!Array.isArray(rows)) throw new ExtractError(`資料表 ${name} 不存在或不是陣列：${dir}`);
  options.onRead?.(file);
  return options.dropBase ? rows.filter((row: { Name?: unknown } | null) => !BASE_ROW.test(String(row?.Name ?? ""))) : rows;
}
