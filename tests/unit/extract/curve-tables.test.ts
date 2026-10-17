import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { curveNotes, evaluateCurve, findCurve, levelsOf, loadCurveTables, parseCurveRef, sampleThreat, type Curve } from "../../../scripts/extract/curve-tables";
import { curveFile, curveOf, rawCurveFiles, ref, richRow, simpleRow } from "../../helpers/curve-tables";

let sourceRoot: string;
const put = async (relative: string, value: unknown): Promise<void> => {
  const file = path.join(sourceRoot, "CurveTables", ...relative.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value), "utf8");
};
const putAll = (files: Record<string, unknown>): Promise<unknown> => Promise.all(Object.entries(files).map(([name, value]) => put(`${name}.json`, value)));
const linear = (...points: [number, number][]): Curve => ({ keys: points.map(([time, value]) => ({ time, value, step: false })), notes: [] });
const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, index) => from + index);

beforeEach(async () => { sourceRoot = await mkdtemp(path.join(tmpdir(), "mcd2-curves-")); });

describe("evaluateCurve", () => {
  it("moves linearly between keys and holds the end values", () => {
    const curve = linear([1, 0], [3, 10]);
    expect(evaluateCurve(curve, 2)).toBe(5);
    expect(evaluateCurve(curve, 0)).toBe(0);
    expect(evaluateCurve(curve, 99)).toBe(10);
  });

  it("holds a step key's value until the next key", () => {
    const curve: Curve = { keys: [{ time: 1, value: 4, step: true }, { time: 3, value: 8, step: true }], notes: [] };
    expect([1, 2, 2.9, 3, 4].map((time) => evaluateCurve(curve, time))).toEqual([4, 4, 4, 8, 8]);
  });

  it("reads a single key as a constant", () => {
    expect(evaluateCurve(linear([1, 1.5]), 17)).toBe(1.5);
  });
});

describe("levelsOf", () => {
  it("spans the whole levels the curves have keys for", () => {
    expect(levelsOf([linear([1, 0], [10, 1]), linear([2, 0], [12, 1])])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("falls back to 1..20 without curves or with a nonsense span", () => {
    expect(levelsOf([])).toHaveLength(20);
    expect(levelsOf([linear([1, 0], [5000, 1])])).toHaveLength(20);
  });
});

describe("parseCurveRef", () => {
  it("takes the table name from the object path", () => {
    expect(parseCurveRef(ref("CT_RarityChanceSettings", "Rare"))).toEqual({ table: "CT_RarityChanceSettings", row: "Rare" });
  });

  it("reads None as no reference", () => {
    expect(parseCurveRef({ CurveTable: "None", RowName: "None" })).toBeUndefined();
    expect(parseCurveRef({ CurveTable: ref("CT_X", "a").CurveTable, RowName: "None" })).toBeUndefined();
  });
});

describe("loadCurveTables", () => {
  it("reads SimpleCurves and RichCurves and matches the game's cross-check numbers", async () => {
    await putAll(rawCurveFiles());
    const { tables, issues } = await loadCurveTables(sourceRoot);
    expect(issues).toEqual([]);
    const effects = (row: string, from: number, to: number): number[] => sampleThreat(curveOf(tables, "CT_EffectThreatBasedChanceAdjustments", row), range(from, to));
    expect(effects("Tier1Effects", 9, 20)).toEqual([1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0]);
    expect(effects("Tier2Effects", 9, 12)).toEqual([0.7, 0.8, 0.9, 1]);
    expect(effects("Tier3Effects", 9, 15)).toEqual([0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
    expect(sampleThreat(curveOf(tables, "CT_DifficultySettings", "DifficultyMultiplierHighAttackPower"), [1])).toEqual([0.6]);
    expect(sampleThreat(curveOf(tables, "CT_RarityChanceSettings", "Rare"))).toHaveLength(20);
  });

  it("finds tables in sub-folders by file name", async () => {
    await put("Spicewood/GameplayLogic/CT_X.json", curveFile("CT_X", "SimpleCurves", { A: simpleRow([[1, 2]]) }));
    const { tables } = await loadCurveTables(sourceRoot);
    expect(findCurve(tables, { table: "CT_X", row: "A" })?.keys).toEqual([{ time: 1, value: 2, step: false }]);
    expect(findCurve(tables, { table: "CT_X", row: "B" })).toBeUndefined();
    expect(findCurve(tables, { table: "CT_Y", row: "A" })).toBeUndefined();
  });

  it("reads numeric interpolation modes: 0 linear, 1 constant", async () => {
    const row = simpleRow([[1, 0], [3, 10]]);
    await put("CT_N.json", curveFile("CT_N", "SimpleCurves", { Lin: { ...row, InterpMode: 0 }, Step: { ...row, InterpMode: 1 } }));
    const { tables, issues } = await loadCurveTables(sourceRoot);
    expect(issues).toEqual([]);
    expect(evaluateCurve(curveOf(tables, "CT_N", "Lin"), 2)).toBe(5);
    expect(evaluateCurve(curveOf(tables, "CT_N", "Step"), 2)).toBe(0);
  });

  it("reads a cubic key as linear and notes it once on the row", async () => {
    await put("CT_C.json", curveFile("CT_C", "RichCurves", { Smooth: richRow([[1, 0], [2, 1], [3, 2]], "RCIM_Cubic") }));
    const { tables, issues } = await loadCurveTables(sourceRoot);
    const smooth = curveOf(tables, "CT_C", "Smooth");
    expect(issues).toEqual([]);
    expect(smooth.notes).toEqual(["interpolation cubic (read as linear)"]);
    expect(curveNotes({ table: "CT_C", row: "Smooth" }, smooth).map((item) => [item.type, item.detail])).toEqual([["curve-unsupported", "CT_C/Smooth: interpolation cubic (read as linear)"]]);
    expect(evaluateCurve(smooth, 1.5)).toBe(0.5);
  });

  it("notes an extrapolation other than constant and still clamps", async () => {
    const loop = { ...simpleRow([[1, 0], [2, 1]]), PostInfinityExtrap: "ERichCurveExtrapolation::RCCE_Cycle" };
    await put("CT_E.json", curveFile("CT_E", "SimpleCurves", { Loop: loop }));
    const { tables } = await loadCurveTables(sourceRoot);
    expect(curveOf(tables, "CT_E", "Loop").notes).toEqual(["extrapolation (read as constant)"]);
    expect(evaluateCurve(curveOf(tables, "CT_E", "Loop"), 9)).toBe(1);
  });

  it("reads a missing folder as no tables and reports it", async () => {
    const { tables, issues } = await loadCurveTables(sourceRoot);
    expect(tables).toEqual({});
    expect(issues.map((item) => item.type)).toEqual(["missing-curve-tables"]);
  });

  it("reports a malformed row, a malformed file and invalid JSON without stopping, and still reads the good ones", async () => {
    await put("CT_GOOD.json", curveFile("CT_GOOD", "SimpleCurves", { A: simpleRow([[1, 2]]), Broken: { Keys: [] } }));
    await put("CT_SHAPE.json", { not: "a curve table" });
    await writeFile(path.join(sourceRoot, "CurveTables", "CT_JSON.json"), "{oops", "utf8");
    const { tables, issues } = await loadCurveTables(sourceRoot);
    expect(Object.keys(tables.CT_GOOD)).toEqual(["A"]);
    expect(tables.CT_SHAPE).toEqual({});
    expect(issues.map((item) => [item.type, item.detail.split(":")[0]])).toEqual([
      ["curve-table-invalid", "CT_GOOD/Broken"], ["curve-table-invalid", "CT_JSON.json"], ["curve-table-invalid", "CT_SHAPE.json"],
    ]);
  });

  it("reports a file name found twice and keeps the first", async () => {
    await put("A/CT_D.json", curveFile("CT_D", "SimpleCurves", { A: simpleRow([[1, 1]]) }));
    await put("B/CT_D.json", curveFile("CT_D", "SimpleCurves", { A: simpleRow([[1, 9]]) }));
    const { tables, issues } = await loadCurveTables(sourceRoot);
    expect(curveOf(tables, "CT_D", "A").keys[0].value).toBe(1);
    expect(issues.map((item) => item.type)).toEqual(["curve-table-duplicate"]);
  });
});
