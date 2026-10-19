import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { extractGuides, readGuidesStatus, type GuidesInput } from "../../../scripts/extract/guides";
import { GuidesDataSchema, GuidesStatusSchema } from "../../../shared/guides-schema";
import { GUIDE_TABLE_FILES, parseGuideTables } from "../../../scripts/extract/guides-tables";
import { curveFile, rawCurveFiles } from "../../helpers/curve-tables";
import { makeEntry } from "../../helpers/entries";
import { REAL_GUIDE_ROWS } from "../../helpers/guide-tables";
import { makeLocales } from "../../helpers/locales";

let sourceRoot: string;
let statusPath: string;

async function putTable(name: string, rows: unknown): Promise<void> {
  const file = path.join(sourceRoot, "DataTables", "UFS", `${name}.json`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(rows), "utf8");
}
async function putCurves(files: Record<string, unknown>): Promise<void> {
  const dir = path.join(sourceRoot, "CurveTables");
  await mkdir(dir, { recursive: true });
  await Promise.all(Object.entries(files).map(([name, rows]) => writeFile(path.join(dir, `${name}.json`), JSON.stringify(rows), "utf8")));
}
const writeStatus = (value: unknown): Promise<void> => writeFile(statusPath, JSON.stringify(value), "utf8");
const SECRET = "0123456789abcdef0123456789abcdef";

const locales = makeLocales({
  "Text/Release/OnboardingLabels.csv": { tutoriallog_springstones_title: { en: "Echo Shards", zh: "回聲碎片" } },
  "Text/Release/DT_DifficultyDefinition.csv": {
    SW_Difficulty_Low_SW_TextEntry_Name: { en: "Easy", zh: "簡單" },
    SW_Difficulty_Low_SW_TextEntry_Description: { en: "Casual play." },
    SW_Difficulty_Normal_SW_TextEntry_Name: { en: "Normal" },
    SW_Difficulty_Normal_SW_TextEntry_Description: { en: "Balanced." },
    SW_Difficulty_High_SW_TextEntry_Name: { en: "Hard" },
    SW_Difficulty_High_SW_TextEntry_Description: { en: "A challenge." },
  },
});
const input = (): GuidesInput => ({ sourceRoot, locales, entries: [makeEntry("Talisman_RangedBuff", "talisman")], statusPath });

beforeEach(async () => {
  sourceRoot = await mkdtemp(path.join(tmpdir(), "mcd2-guides-"));
  statusPath = path.join(sourceRoot, "guides-status.json");
  await writeStatus({ enchantCostPerLevel: false, rarityOdds: false, threatBalanceRow: false });
  const rows = REAL_GUIDE_ROWS();
  await Promise.all((Object.keys(GUIDE_TABLE_FILES) as (keyof typeof GUIDE_TABLE_FILES)[]).map((key) => putTable(GUIDE_TABLE_FILES[key], rows[key])));
  await putTable(["Online", "Constants"].join(""), { ApiKey: SECRET });
  await putCurves(rawCurveFiles());
});

describe("extractGuides", () => {
  it("builds valid guides data from the tables and copies the status flags", async () => {
    const { data, tablesRead } = await extractGuides(input());
    expect(GuidesDataSchema.parse(data)).toEqual(data);
    expect(data.verified).toEqual({ enchantCostPerLevel: false, rarityOdds: false, threatBalanceRow: false, affixOdds: false, dropOdds: false });
    expect(data.vendors).toHaveLength(3);
    expect(data.caps).toEqual({ emeralds: 99999, echoShards: 100, level: 100 });
    expect(data.enchanting.maxLevel).toBe(3);
    expect(data.texts.echoShards.html.zh).toBe("回聲碎片");
    expect(data.threat).toHaveLength(20);
    expect(data.threat[0]).toMatchObject({ level: 1, effectTiers: [1, 0, 0], rarity: { common: 1, rare: 0.6, special: 0, unique: 0 } });
    expect(data.difficulty.map((item) => [item.id, item.incoming, item.outgoing])).toEqual([["low", 2, 1.5], ["normal", 1, 1], ["high", 0.8, 0.6]]);
    expect(tablesRead).toContain("DT_PlayerDefinition.json");
    expect(tablesRead.some((file) => /constants/i.test(file))).toBe(false);
    expect(JSON.stringify(data)).not.toContain(SECRET);
  });

  it("flips a fact to verified from the status file alone", async () => {
    await writeStatus({ enchantCostPerLevel: true, rarityOdds: false, threatBalanceRow: false });
    expect((await extractGuides(input())).data.verified.enchantCostPerLevel).toBe(true);
  });

  it("reports missing tables and leaves their parts empty", async () => {
    const empty = await mkdtemp(path.join(tmpdir(), "mcd2-guides-empty-"));
    const { data, issues } = await extractGuides({ ...input(), sourceRoot: empty });
    expect(issues[0]?.type).toBe("missing-guides-tables");
    expect(issues[0]?.detail).toContain("DT_PlayerDefinition.json");
    expect(data.vendors).toEqual([]);
    expect(data.caps).toBeNull();
    expect(data.merchant).toBeNull();
    expect(data.threat).toEqual([]);
    expect(data.difficulty).toEqual([]);
    expect(issues.map((item) => item.type)).toContain("missing-curve-tables");
  });

  it("reports an assumed Normal row, and a malformed curve table without stopping", async () => {
    const { issues } = await extractGuides(input());
    expect(issues.filter((item) => item.detail.includes("NormalDifficultyMultiplier"))).toHaveLength(2);
    await putCurves({ CT_BAD: curveFile("CT_BAD", "SimpleCurves", { A: { Keys: [] } }) });
    const again = await extractGuides(input());
    expect(again.data.threat).toHaveLength(20);
    expect(again.issues.some((item) => item.type === "curve-table-invalid" && item.detail.startsWith("CT_BAD/A"))).toBe(true);
  });

  it("stops with the field named when a built value breaks the output schema", async () => {
    const rows = REAL_GUIDE_ROWS();
    const player = JSON.parse(JSON.stringify(rows.player).replace('"2":10', '"2":-10')) as unknown[];
    await putTable(GUIDE_TABLE_FILES.player, player);
    await expect(extractGuides(input())).rejects.toThrow(/guides\.json[\s\S]*vendors/);
  });

  it("stops on a table whose fields changed, naming it", async () => {
    await putTable(GUIDE_TABLE_FILES.progression, [{ Name: "Town", TypeTag: { TagName: "SW.Progression.Town.FirstVisit" } }]);
    await expect(extractGuides(input())).rejects.toThrow(/DT_ProgressionDefinition/);
  });
});

describe("readGuidesStatus", () => {
  it("stops when the status file is missing or malformed, naming it", async () => {
    await expect(readGuidesStatus(path.join(sourceRoot, "nope.json"))).rejects.toThrow(/nope\.json/);
    await writeStatus({ enchantCostPerLevel: "yes" });
    await expect(readGuidesStatus(statusPath)).rejects.toThrow(/guides-status\.json/);
  });

  it("accepts the repository's own status file", () => {
    const raw: unknown = JSON.parse(readFileSync(path.resolve(__dirname, "../../../scripts/extract/guides-status.json"), "utf8"));
    expect(GuidesStatusSchema.parse(raw)).toEqual({ enchantCostPerLevel: false, rarityOdds: false, threatBalanceRow: false, affixOdds: false, dropOdds: false });
  });

  it("reads a status file written before the affix and drop odds flags as unconfirmed", () => {
    const old = GuidesStatusSchema.parse({ enchantCostPerLevel: true, rarityOdds: true, threatBalanceRow: true });
    expect([old.affixOdds, old.dropOdds]).toEqual([false, false]);
  });
});

describe("parseGuideTables", () => {
  it("names every table whose fields changed at once", () => {
    const rows = { ...REAL_GUIDE_ROWS(), rarity: [{ Name: "Common" }], npcs: [{ Name: 5 }] };
    expect(() => parseGuideTables(rows)).toThrow(/DT_RarityDefinition[\s\S]*DT_NPCDefinition|DT_NPCDefinition[\s\S]*DT_RarityDefinition/);
  });
});
