import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadCurveTables, type CurveTables } from "../../../scripts/extract/curve-tables";
import { buildDifficulty, buildThreat } from "../../../scripts/extract/guides-threat";
import { curveFile, rawCurveFiles, richRow, simpleRow } from "../../helpers/curve-tables";
import { difficultyRows, gameBalanceRows, guideTables } from "../../helpers/guide-tables";
import { makeLocales, ns } from "../../helpers/locales";

let curves: CurveTables;

async function curvesOf(files: Record<string, unknown>): Promise<CurveTables> {
  const root = await mkdtemp(path.join(tmpdir(), "mcd2-threat-"));
  await mkdir(path.join(root, "CurveTables"), { recursive: true });
  await Promise.all(Object.entries(files).map(([name, value]) => writeFile(path.join(root, "CurveTables", `${name}.json`), JSON.stringify(value), "utf8")));
  return (await loadCurveTables(root)).tables;
}

beforeAll(async () => { curves = await curvesOf(rawCurveFiles()); });

const DIFFICULTY = ns("DT_DifficultyDefinition");
const entry = (difficulty: string, text: string) => `SW_Difficulty_${difficulty}_SW_TextEntry_${text}`;
const difficultyTexts = () => makeLocales({
  [DIFFICULTY]: Object.fromEntries(["Normal", "Low", "High"].flatMap((name) => [
    [entry(name, "Name"), { en: name, zh: `${name}-zh` }],
    [entry(name, "Description"), { en: `${name} description` }],
    [entry(name, "Description_DifficultyDamageReceived"), { en: `${name} received` }],
    [entry(name, "Description_DifficultyDamageDealt"), { en: `${name} dealt` }],
  ])),
});

describe("buildThreat", () => {
  it("samples every curve at threat 1..20 from the SecondPass row", () => {
    const { threat, issues } = buildThreat(guideTables(), curves);
    expect(issues).toEqual([]);
    expect(threat.map((row) => row.level)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    expect(threat[0]).toEqual({
      level: 1,
      recommendedLevel: 0,
      attackPower: 1,
      damageResistance: 1,
      effectTiers: [1, 0, 0],
      rarity: { common: 1, rare: 0.6, special: 0, unique: 0 },
      mobVariantChance: { min: 0.05, max: 0.1 },
      soulStatedCost: { min: 1000, max: 4000 },
      minibossCost: { min: 4000, max: 8000 },
    });
  });

  it("matches the game's cross-check numbers", () => {
    const { threat } = buildThreat(guideTables(), curves);
    const at = (level: number) => threat[level - 1];
    expect(threat.slice(8, 20).map((row) => row.effectTiers?.[0])).toEqual([1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0]);
    expect(threat.slice(8, 12).map((row) => row.effectTiers?.[1])).toEqual([0.7, 0.8, 0.9, 1]);
    expect(threat.slice(8, 15).map((row) => row.effectTiers?.[2])).toEqual([0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
    expect(at(20).rarity).toEqual({ common: 0.5, rare: 0.5, special: 1, unique: 1 });
    expect(at(20).recommendedLevel).toBe(95);
    expect(at(2).recommendedLevel).toBe(5);
  });

  it("uses constant (step) curves as steps", () => {
    const { threat } = buildThreat(guideTables(), curves);
    expect(threat[2]).toMatchObject({ attackPower: 0.91, damageResistance: 0.83, soulStatedCost: { min: 1000, max: 4000 }, minibossCost: { min: 3750, max: 7500 } });
    expect(threat[3].mobVariantChance).toEqual({ min: 0.1, max: 0.2 });
  });

  it("reports a curve it reads with a note, such as a cubic key", async () => {
    const files = rawCurveFiles();
    files.CT_GlobalDifficultySettings = curveFile("CT_GlobalDifficultySettings", "RichCurves", {
      PlayerAttackPower: richRow([[1, 1], [20, 0.5]], "RCIM_Cubic"),
      PlayerDamageResistance: richRow([[1, 1], [20, 0.5]]),
    });
    const { threat, issues } = buildThreat(guideTables(), await curvesOf(files));
    expect(threat[0].attackPower).toBe(1);
    expect(issues.map((item) => [item.type, item.detail])).toEqual([["curve-unsupported", "CT_GlobalDifficultySettings/PlayerAttackPower: interpolation cubic (read as linear)"]]);
  });

  it("takes the threat levels from the curves' keys instead of a fixed 1..20", async () => {
    const files = rawCurveFiles();
    files.CT_EffectThreatBasedChanceAdjustments = curveFile("CT_EffectThreatBasedChanceAdjustments", "SimpleCurves", {
      Tier1Effects: simpleRow([[1, 1], [12, 0]]), Tier2Effects: simpleRow([[1, 0], [12, 1]]), Tier3Effects: simpleRow([[1, 0], [12, 1]]),
    });
    for (const name of ["CT_RarityChanceSettings", "CT_GlobalDifficultySettings", "CT_MobSpawnSettings"]) delete files[name];
    const { threat } = buildThreat(guideTables(), await curvesOf(files));
    expect(threat.map((row) => row.level)).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
    expect(threat[11]).toMatchObject({ recommendedLevel: 55, effectTiers: [0, 1, 1] });
  });

  it("leaves out a part whose curve is missing and reports it", async () => {
    const files = rawCurveFiles();
    delete files.CT_RarityChanceSettings;
    const { threat, issues } = buildThreat(guideTables(), await curvesOf(files));
    expect(threat[0].rarity).toBeUndefined();
    expect(threat[0].effectTiers).toEqual([1, 0, 0]);
    expect(issues.map((item) => item.type)).toEqual(Array(4).fill("guides-value-missing"));
    expect(issues[0].detail).toContain("SW.Rarity.Common");
  });

  it("leaves out the effect tiers when one of the three is missing", async () => {
    const files = rawCurveFiles();
    files.CT_EffectThreatBasedChanceAdjustments = curveFile("CT_EffectThreatBasedChanceAdjustments", "SimpleCurves", {});
    const { threat, issues } = buildThreat(guideTables(), await curvesOf(files));
    expect(threat[0].effectTiers).toBeUndefined();
    expect(issues).toHaveLength(3);
  });

  it("leaves out the mob spawn parts without the world actor's spawn settings", () => {
    const { threat, issues } = buildThreat(guideTables({ worldActor: [{ Name: "WorldActor" }] }), curves);
    expect(threat[0].mobVariantChance).toBeUndefined();
    expect(threat[0].minibossCost).toBeUndefined();
    expect(issues.map((item) => item.detail)).toEqual(["DT_WorldActorDefinition: SW.Asset.MobSpawnSettings"]);
  });

  it("gives no threat table without the SecondPass row, or without any curve table", () => {
    const withoutRow = buildThreat(guideTables({ gameBalance: gameBalanceRows().slice(0, 1) }), curves);
    expect(withoutRow.threat).toEqual([]);
    expect(withoutRow.issues.map((item) => item.detail)).toEqual(["DT_GameBalanceDefinition: SecondPass"]);
    expect(buildThreat(guideTables(), {}).threat).toEqual([]);
  });

  it("leaves out the recommended level when the row has no levels per threat", () => {
    const [active, second] = gameBalanceRows();
    const plain = { ...second, GameBalanceDefinition: { ...second.GameBalanceDefinition, CharacterLevelsPerThreat: undefined } };
    expect(buildThreat(guideTables({ gameBalance: [active, plain] }), curves).threat[0].recommendedLevel).toBeUndefined();
  });
});

describe("buildDifficulty", () => {
  it("lists low, normal and high with the game's texts and their multipliers", () => {
    const { difficulty } = buildDifficulty(guideTables(), curves, difficultyTexts());
    expect(difficulty.map((item) => item.id)).toEqual(["low", "normal", "high"]);
    const [low, , high] = difficulty;
    expect(low).toMatchObject({ scalar: -1, incoming: 2, outgoing: 1.5, noRareDrops: true });
    expect(low.name).toMatchObject({ html: { en: "Low", zh: "Low-zh" }, untranslated: [] });
    expect(low.description.html.en).toBe("Low description");
    expect(low.received?.html.en).toBe("Low received");
    expect(low.dealt?.html.en).toBe("Low dealt");
    expect(high).toMatchObject({ scalar: 1, incoming: 0.8, outgoing: 0.6 });
    expect(high.noRareDrops).toBeUndefined();
    expect(high.assumed).toBeUndefined();
  });

  it("assumes 1 for Normal's missing multiplier row and reports it", () => {
    const { difficulty, issues } = buildDifficulty(guideTables(), curves, difficultyTexts());
    expect(difficulty[1]).toMatchObject({ id: "normal", scalar: 0, incoming: 1, outgoing: 1, assumed: true });
    expect(issues.map((item) => [item.type, item.detail])).toEqual([
      ["guides-value-missing", "DT_DifficultyDefinition Normal: CT_DifficultySettings/NormalDifficultyMultiplier (assumed 1)"],
      ["guides-value-missing", "DT_DifficultyDefinition Normal: CT_DifficultySettings/NormalDifficultyMultiplier (assumed 1)"],
    ]);
  });

  it("skips a difficulty whose multiplier row is missing, unless it is Normal", () => {
    const { difficulty, issues } = buildDifficulty(guideTables(), {}, difficultyTexts());
    expect(difficulty.map((item) => item.id)).toEqual(["normal"]);
    expect(issues.filter((item) => item.detail.includes("Low"))).toHaveLength(2);
  });

  it("keeps a difficulty without game texts, named after its row, and reports the missing texts", () => {
    const { difficulty, issues } = buildDifficulty(guideTables(), curves, makeLocales({ [DIFFICULTY]: {} }));
    expect(difficulty.map((item) => [item.id, item.name.html.en, item.description, item.incoming])).toEqual([
      ["low", "Low", undefined, 2], ["normal", "Normal", undefined, 1], ["high", "High", undefined, 0.8],
    ]);
    expect(issues.filter((item) => item.type === "guides-text-fallback")).toHaveLength(12);
  });

  it("reports a difficulty row it has no id for, and does not list it", () => {
    const [normal] = difficultyRows();
    const { difficulty, issues } = buildDifficulty(guideTables({ difficulty: [{ ...normal, Name: "Nightmare" }] }), curves, difficultyTexts());
    expect(difficulty).toEqual([]);
    expect(issues.map((item) => item.detail)).toEqual(["DT_DifficultyDefinition: Nightmare is not low, normal or high"]);
  });

  it("reports Low without a rarity-chance row of its own", () => {
    const rows = guideTables().rarityChance.filter((row) => row.Name !== "LowDifficulty");
    const { difficulty, issues } = buildDifficulty(guideTables({ rarityChance: rows }), curves, difficultyTexts());
    expect(difficulty[0].noRareDrops).toBeUndefined();
    expect(issues.map((item) => item.detail)).toContain("DT_RarityChanceDefinition: no row for SW.Difficulty.Low");
  });

  it("uses the first key of a multiplier curve and reports a curve with more", async () => {
    const files = rawCurveFiles();
    files.CT_DifficultySettings = curveFile("CT_DifficultySettings", "RichCurves", {
      DifficultyMultiplierLowAttackPower: richRow([[1, 1.5], [5, 9]]),
      DifficultyMultiplierLowResistance: richRow([[1, 2]]),
      DifficultyMultiplierHighAttackPower: richRow([[1, 0.6]]),
      DifficultyMultiplierHighResistance: richRow([[1, 0.8]]),
    });
    const { difficulty, issues } = buildDifficulty(guideTables(), await curvesOf(files), difficultyTexts());
    expect(difficulty[0].outgoing).toBe(1.5);
    expect(issues.map((item) => item.detail)).toContain("CT_DifficultySettings/DifficultyMultiplierLowAttackPower: 2 keys, only the first is used");
  });
});
