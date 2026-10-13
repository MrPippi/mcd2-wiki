import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { extractGuides, readGuidesStatus, type GuidesInput } from "../../../scripts/extract/guides";
import { GuidesDataSchema, GuidesStatusSchema } from "../../../scripts/extract/guides-schema";
import { GUIDE_TABLE_FILES, parseGuideTables } from "../../../scripts/extract/guides-tables";
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
const writeStatus = (value: unknown): Promise<void> => writeFile(statusPath, JSON.stringify(value), "utf8");
const SECRET = "0123456789abcdef0123456789abcdef";

const locales = makeLocales({ "Text/Release/OnboardingLabels.csv": { tutoriallog_springstones_title: { en: "Echo Shards", zh: "回聲碎片" } } });
const input = (): GuidesInput => ({ sourceRoot, locales, entries: [makeEntry("Talisman_RangedBuff", "talisman")], statusPath });

beforeEach(async () => {
  sourceRoot = await mkdtemp(path.join(tmpdir(), "mcd2-guides-"));
  statusPath = path.join(sourceRoot, "guides-status.json");
  await writeStatus({ enchantCostPerLevel: false, rarityOdds: false });
  const rows = REAL_GUIDE_ROWS();
  await Promise.all((Object.keys(GUIDE_TABLE_FILES) as (keyof typeof GUIDE_TABLE_FILES)[]).map((key) => putTable(GUIDE_TABLE_FILES[key], rows[key])));
  await putTable(["Online", "Constants"].join(""), { ApiKey: SECRET });
});

describe("extractGuides", () => {
  it("builds valid guides data from the tables and copies the status flags", async () => {
    const { data, tablesRead } = await extractGuides(input());
    expect(GuidesDataSchema.parse(data)).toEqual(data);
    expect(data.verified).toEqual({ enchantCostPerLevel: false, rarityOdds: false });
    expect(data.vendors).toHaveLength(3);
    expect(data.caps).toEqual({ emeralds: 99999, echoShards: 100, level: 100 });
    expect(data.enchanting.maxLevel).toBe(3);
    expect(data.texts.echoShards.html.zh).toBe("回聲碎片");
    expect(tablesRead).toContain("DT_PlayerDefinition.json");
    expect(tablesRead.some((file) => /constants/i.test(file))).toBe(false);
    expect(JSON.stringify(data)).not.toContain(SECRET);
  });

  it("flips a fact to verified from the status file alone", async () => {
    await writeStatus({ enchantCostPerLevel: true, rarityOdds: false });
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
    expect(GuidesStatusSchema.parse(raw)).toEqual({ enchantCostPerLevel: false, rarityOdds: false });
  });
});

describe("parseGuideTables", () => {
  it("names every table whose fields changed at once", () => {
    const rows = { ...REAL_GUIDE_ROWS(), rarity: [{ Name: "Common" }], npcs: [{ Name: 5 }] };
    expect(() => parseGuideTables(rows)).toThrow(/DT_RarityDefinition[\s\S]*DT_NPCDefinition|DT_NPCDefinition[\s\S]*DT_RarityDefinition/);
  });
});
