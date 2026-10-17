/** Hand-made CurveTable exports in CUE4Parse's shape, with the real 1.1.2.0 values the threat guide's cross-checks use. */
import { findCurve, parseCurveRef, type Curve, type CurveTables } from "../../scripts/extract/curve-tables";

type Points = readonly (readonly [time: number, value: number])[];

/** A SimpleCurves row: one InterpMode for the whole row. */
export const simpleRow = (points: Points, mode = "ERichCurveInterpMode::RCIM_Linear") => ({
  InterpMode: mode,
  Keys: points.map(([Time, Value]) => ({ Time, Value })),
  DefaultValue: 3.4028235e38,
  PreInfinityExtrap: "ERichCurveExtrapolation::RCCE_Constant",
  PostInfinityExtrap: "ERichCurveExtrapolation::RCCE_Constant",
});

/** A RichCurves row: an InterpMode on every key. */
export const richRow = (points: Points, mode = "RCIM_Linear") => ({
  Keys: points.map(([Time, Value]) => ({ InterpMode: mode, TangentMode: "RCTM_Auto", Time, Value })),
  DefaultValue: 0,
  PreInfinityExtrap: "ERichCurveExtrapolation::RCCE_Constant",
  PostInfinityExtrap: "ERichCurveExtrapolation::RCCE_Constant",
});

const steps = (points: Points) => simpleRow(points, "ERichCurveInterpMode::RCIM_Constant");

export const curveFile = (Name: string, CurveTableMode: "SimpleCurves" | "RichCurves", Rows: Record<string, unknown>) => [
  { Type: "CurveTable", Name, CurveTableMode, Rows },
];

/** The raw exports by file name (without .json). */
export const rawCurveFiles = (): Record<string, unknown> => ({
  CT_EffectThreatBasedChanceAdjustments: curveFile("CT_EffectThreatBasedChanceAdjustments", "SimpleCurves", {
    Tier1Effects: simpleRow([[1, 1], [10, 1], [18, 0.2], [20, 0]]),
    Tier2Effects: simpleRow([[1, 0], [2, 0], [12, 1], [20, 1]]),
    Tier3Effects: simpleRow([[1, 0], [5, 0], [15, 1], [20, 1]]),
  }),
  CT_RarityChanceSettings: curveFile("CT_RarityChanceSettings", "SimpleCurves", {
    Common: steps([[1, 1], [2, 0.9], [3, 0.8], [4, 0.7], [5, 0.6], [6, 0.5], [20, 0.5]]),
    Rare: steps([[1, 0.6], [2, 0.7], [3, 0.8], [4, 0.9], [5, 1], [11, 0.9], [12, 0.8], [13, 0.7], [14, 0.6], [15, 0.5], [20, 0.5]]),
    Special: steps([[1, 0], [2, 0.1], [3, 0.2], [4, 0.3], [5, 0.4], [6, 0.5], [7, 0.6], [8, 0.7], [9, 0.8], [10, 0.9], [11, 1], [20, 1]]),
    Unique: steps([[1, 0], [4, 0.1], [5, 0.2], [6, 0.3], [7, 0.4], [8, 0.5], [9, 0.6], [10, 0.7], [11, 0.8], [12, 0.9], [13, 1], [20, 1]]),
  }),
  CT_GlobalDifficultySettings: curveFile("CT_GlobalDifficultySettings", "SimpleCurves", {
    PlayerAttackPower: steps([[1, 1], [2, 0.95], [3, 0.91], [4, 0.83], [5, 0.77], [20, 0.36]]),
    PlayerDamageResistance: steps([[1, 1], [2, 0.91], [3, 0.83], [4, 0.77], [5, 0.71], [20, 0.41]]),
  }),
  CT_MobSpawnSettings: curveFile("CT_MobSpawnSettings", "SimpleCurves", {
    VariantSpawnChancePercentMin: steps([[1, 0.05], [2, 0.08], [4, 0.1], [20, 0.4]]),
    VariantSpawnChancePercentMax: steps([[1, 0.1], [2, 0.15], [3, 0.2], [20, 0.65]]),
    SoulStatedSpawnCostMin: steps([[1, 1000], [7, 900], [9, 850], [10, 700], [20, 700]]),
    SoulStatedSpawnCostMax: steps([[1, 4000], [4, 3750], [5, 3500], [20, 2000]]),
    MinibossSpawnCostMin: steps([[1, 4000], [3, 3750], [4, 3500], [20, 1500]]),
    MinibossSpawnCostMax: steps([[1, 8000], [3, 7500], [4, 7000], [20, 5000]]),
  }),
  CT_DifficultySettings: curveFile("CT_DifficultySettings", "RichCurves", {
    DifficultyMultiplierLowAttackPower: richRow([[1, 1.5]]),
    DifficultyMultiplierLowResistance: richRow([[1, 2]]),
    DifficultyMultiplierHighAttackPower: richRow([[1, 0.59999996]]),
    DifficultyMultiplierHighResistance: richRow([[1, 0.8]]),
  }),
});

/** A curve of the loaded tables; fails the test when the row is not there. */
export const curveOf = (tables: CurveTables, table: string, row: string): Curve => {
  const found = findCurve(tables, { table, row });
  if (!found) throw new Error(`no curve ${table}/${row} in the test tables`);
  return found;
};

/** A `{CurveTable, RowName}` reference in the game's object-path form. */
export const ref = (table: string, row: string) => ({
  CurveTable: `/Script/Engine.CurveTable'/Game/Spicewood/GameplayLogic/${table}.${table}'`,
  RowName: row,
});
export const refParsed = (table: string, row: string) => parseCurveRef(ref(table, row));
