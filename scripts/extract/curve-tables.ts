/**
 * The game's CurveTables (CT_*.json, CUE4Parse exports of /Game/Spicewood/GameplayLogic/). Rows are SimpleCurves (a row-level
 * InterpMode) or RichCurves (an InterpMode per key). Only linear and constant (step) interpolation is read; a cubic key is
 * read as linear. Beyond the end keys the value stays constant. A curve carries a note for each such deviation, so the guide
 * that uses the curve reports it (the many curves nothing reads stay silent).
 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { ExtractError, formatZodIssue, issue, type Issue } from "./issues";
import { readTableFile } from "./table-reader";

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
/** Rows are checked one by one, so one malformed curve costs only itself. */
const CurveTableSchema = z.looseObject({ Rows: z.record(z.string(), z.unknown()) });
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
  /** What the export has that this reader does not follow ("interpolation cubic (read as linear)"). */
  readonly notes: readonly string[];
}

export type CurveTables = Readonly<Record<string, Readonly<Record<string, Curve>>>>;

export interface CurveRef {
  readonly table: string;
  readonly row: string;
}

/** One issue per note of a curve a guide actually reads. */
export const curveNotes = (ref: CurveRef, curve: Curve): Issue[] => curve.notes.map((note) => issue("curve-unsupported", `${ref.table}/${ref.row}: ${note}`));

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

function readRow(row: z.infer<typeof CurveRowSchema>): Curve {
  const found = row.Keys.map((key) => {
    const name = interpName(key.InterpMode ?? row.InterpMode ?? "linear");
    return { key, name };
  });
  const unsupported = [...new Set(found.map(({ name }) => name).filter((name) => name !== "linear" && name !== "constant"))];
  const extrapolations = [row.PreInfinityExtrap, row.PostInfinityExtrap].filter((raw): raw is string | number => raw !== undefined);
  return {
    keys: found.map(({ key, name }) => ({ time: key.Time, value: key.Value, step: name === "constant" })).sort((a, b) => a.time - b.time),
    notes: [
      ...unsupported.map((name) => `interpolation ${name} (read as linear)`),
      ...(extrapolations.every(isConstantExtrapolation) ? [] : ["extrapolation (read as constant)"]),
    ],
  };
}

interface ReadTable {
  readonly name: string;
  readonly rows: Record<string, Curve>;
  readonly issues: Issue[];
}

/** One file; whatever is malformed (the file, or single rows) is reported and skipped, so only the curves a guide reads must be valid. */
function readTable(file: string, raw: unknown): ReadTable {
  const name = path.basename(file, ".json");
  const parsed = CurveFileSchema.safeParse(raw);
  if (!parsed.success) {
    return { name, rows: {}, issues: [issue("curve-table-invalid", `${name}.json: ${parsed.error.issues.slice(0, 2).map(formatZodIssue).join("；")}`)] };
  }
  const rows = Object.entries(parsed.data[0].Rows).map(([row, value]) => ({ row, parsed: CurveRowSchema.safeParse(value) }));
  return {
    name,
    rows: Object.fromEntries(rows.flatMap(({ row, parsed: one }) => (one.success ? [[row, readRow(one.data)]] : []))),
    issues: rows.flatMap(({ row, parsed: one }) => (one.success ? [] : [issue("curve-table-invalid", `${name}/${row}: ${one.error.issues.slice(0, 2).map(formatZodIssue).join("；")}`)])),
  };
}

async function readCurveFile(file: string): Promise<ReadTable> {
  try {
    return readTable(file, await readTableFile(file, `曲線表 ${path.basename(file)}`));
  } catch (error) {
    if (!(error instanceof ExtractError)) throw error;
    return { name: path.basename(file, ".json"), rows: {}, issues: [issue("curve-table-invalid", `${path.basename(file)}: ${error.message}`)] };
  }
}

async function listCurveFiles(dir: string): Promise<string[] | undefined> {
  try {
    const found = await readdir(dir, { recursive: true });
    return found.filter((file) => /^CT_.+\.json$/.test(path.basename(file))).sort().map((file) => path.join(dir, file));
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
  // One file at a time: there are few, and a failure then names its own file.
  const read = await files.reduce<Promise<ReadTable[]>>(async (done, file) => [...(await done), await readCurveFile(file)], Promise.resolve([]));
  const first = read.filter((table, index) => read.findIndex((other) => other.name === table.name) === index);
  const duplicates = read.filter((table) => !first.includes(table)).map((table) => issue("curve-table-duplicate", `${table.name}.json is found more than once; the first is used`));
  return { tables: Object.fromEntries(first.map(({ name, rows }) => [name, rows])), issues: [...first.flatMap(({ issues }) => issues), ...duplicates] };
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

const MAX_LEVELS = 100;

/** The whole threat levels the curves have keys for (first key to last key); 1..20 without curves or when the span makes no sense. */
export function levelsOf(curves: readonly Curve[]): number[] {
  if (curves.length === 0) return [...THREAT_LEVELS];
  const from = Math.max(1, Math.ceil(Math.min(...curves.map((curve) => curve.keys[0].time))));
  const to = Math.floor(Math.max(...curves.map((curve) => curve.keys[curve.keys.length - 1].time)));
  return to >= from && to - from < MAX_LEVELS ? Array.from({ length: to - from + 1 }, (_, index) => from + index) : [...THREAT_LEVELS];
}
