/**
 * The game's CurveTables (CT_*.json, CUE4Parse exports of /Game/Spicewood/GameplayLogic/). Rows are SimpleCurves (a row-level
 * InterpMode) or RichCurves (an InterpMode per key). Only linear and constant (step) interpolation is read; a cubic key is
 * read as linear and reported. Beyond the end keys the value stays constant.
 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { ExtractError, formatZodIssue, issue, type Issue } from "./issues";
import { readJsonFile } from "./read-json";

export const CURVE_TABLES_DIR = "CurveTables";
/** The threat levels the game offers. */
export const THREAT_LEVELS: readonly number[] = Array.from({ length: 20 }, (_, index) => index + 1);

const Mode = z.union([z.string(), z.number()]);
const CurveKeySchema = z.looseObject({ Time: z.number(), Value: z.number(), InterpMode: Mode.optional() });
const CurveRowSchema = z.looseObject({
  InterpMode: Mode.optional(),
  Keys: z.array(CurveKeySchema).min(1),
  PreInfinityExtrap: Mode.optional(),
  PostInfinityExtrap: Mode.optional(),
});
const CurveTableSchema = z.looseObject({ Rows: z.record(z.string(), CurveRowSchema) });
const CurveFileSchema = z.tuple([CurveTableSchema]);

export interface CurveKey {
  readonly time: number;
  readonly value: number;
  /** The value holds until the next key instead of moving toward it. */
  readonly step: boolean;
}

export interface Curve {
  /** Sorted by time; never empty. */
  readonly keys: readonly CurveKey[];
}

export type CurveTables = Readonly<Record<string, Readonly<Record<string, Curve>>>>;

export interface CurveRef {
  readonly table: string;
  readonly row: string;
}

export interface LoadedCurveTables {
  readonly tables: CurveTables;
  readonly issues: Issue[];
}

/** UE's ERichCurveInterpMode as the exports write it: a number, `RCIM_Linear`, or `ERichCurveInterpMode::RCIM_Linear`. */
const INTERP_NAMES = ["linear", "constant", "cubic", "none"] as const;

function interpName(raw: string | number): string {
  if (typeof raw === "number") return INTERP_NAMES[raw] ?? String(raw);
  return (raw.split("::").at(-1) ?? raw).replace(/^RCIM_/, "").toLowerCase();
}

/** UE's ERichCurveExtrapolation value 4 is RCCE_Constant. */
const isConstantExtrapolation = (raw: string | number): boolean => raw === 4 || (typeof raw === "string" && raw.endsWith("RCCE_Constant"));

const roundValue = (value: number): number => Math.round(value * 10_000) / 10_000;

/** A curve value without float noise from the export (0.79999995 → 0.8). */
export const cleanCurveValue = roundValue;

function readRow(where: string, row: z.infer<typeof CurveRowSchema>): { curve: Curve; issues: Issue[] } {
  const found = row.Keys.map((key) => {
    const name = interpName(key.InterpMode ?? row.InterpMode ?? "linear");
    return { key, name };
  });
  const unsupported = [...new Set(found.map(({ name }) => name).filter((name) => name !== "linear" && name !== "constant"))];
  const extrapolations = [row.PreInfinityExtrap, row.PostInfinityExtrap].filter((raw): raw is string | number => raw !== undefined);
  return {
    curve: {
      keys: found.map(({ key, name }) => ({ time: key.Time, value: key.Value, step: name === "constant" })).sort((a, b) => a.time - b.time),
    },
    issues: [
      ...unsupported.map((name) => issue("curve-unsupported", `${where}: interpolation ${name} (read as linear)`)),
      ...(extrapolations.every(isConstantExtrapolation) ? [] : [issue("curve-unsupported", `${where}: extrapolation (read as constant)`)]),
    ],
  };
}

function readTable(file: string, raw: unknown): { name: string; rows: Record<string, Curve>; issues: Issue[] } {
  const parsed = CurveFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ExtractError(`曲線表 ${file} 欄位與預期不符（遊戲更新了格式？）：${parsed.error.issues.slice(0, 3).map(formatZodIssue).join("；")}`);
  }
  const name = path.basename(file, ".json");
  const rows = Object.entries(parsed.data[0].Rows).map(([row, value]) => ({ row, ...readRow(`${name}/${row}`, value) }));
  return { name, rows: Object.fromEntries(rows.map(({ row, curve }) => [row, curve])), issues: rows.flatMap(({ issues }) => issues) };
}

async function listCurveFiles(dir: string): Promise<string[] | undefined> {
  try {
    const found = await readdir(dir, { recursive: true });
    return found.filter((file) => /^CT_.+\.json$/.test(path.basename(file))).map((file) => path.join(dir, file));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new ExtractError(`無法讀取曲線表資料夾：${dir}（${(error as Error).message}）`);
  }
}

/** Reads every CT_*.json under source-data/CurveTables; a missing folder reads as no tables and is reported. */
export async function loadCurveTables(sourceRoot: string): Promise<LoadedCurveTables> {
  const dir = path.join(sourceRoot, CURVE_TABLES_DIR);
  const files = await listCurveFiles(dir);
  if (!files) return { tables: {}, issues: [issue("missing-curve-tables", CURVE_TABLES_DIR)] };
  const tables = await Promise.all(files.map(async (file) => readTable(file, await readJsonFile(file, `曲線表 ${path.basename(file)}`))));
  return {
    tables: Object.fromEntries(tables.map(({ name, rows }) => [name, rows])),
    issues: tables.flatMap(({ issues }) => issues),
  };
}

const REF_FILE = /\/([^/.']+)\.[^/.']+'?$/;

/** `{CurveTable: "/Script/Engine.CurveTable'/Game/.../CT_X.CT_X'", RowName}` → the table and row; undefined for "None". */
export function parseCurveRef(ref: { readonly CurveTable: string; readonly RowName: string }): CurveRef | undefined {
  const table = REF_FILE.exec(ref.CurveTable)?.[1];
  return table && ref.RowName !== "None" && ref.RowName !== "" ? { table, row: ref.RowName } : undefined;
}

/** The curve a reference names; undefined when the table or row is not in the data. */
export function findCurve(tables: CurveTables, ref: CurveRef): Curve | undefined {
  const rows = Object.hasOwn(tables, ref.table) ? tables[ref.table] : undefined;
  return rows && Object.hasOwn(rows, ref.row) ? rows[ref.row] : undefined;
}

/** The curve's value at `time`: step keys hold, linear keys move to the next key, the ends stay constant. */
export function evaluateCurve(curve: Curve, time: number): number {
  const { keys } = curve;
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (time <= first.time) return first.value;
  if (time >= last.time) return last.value;
  const index = keys.findLastIndex((key) => key.time <= time);
  const from = keys[index];
  const to = keys[index + 1];
  return from.step ? from.value : from.value + ((to.value - from.value) * (time - from.time)) / (to.time - from.time);
}

/** The curve's value at each threat level (1..20), cleaned of float noise. */
export const sampleThreat = (curve: Curve, levels: readonly number[] = THREAT_LEVELS): number[] =>
  levels.map((level) => roundValue(evaluateCurve(curve, level)));
