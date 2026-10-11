import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MapDataSchema } from "../../../scripts/extract/map-schema";
import { areaMarkers, areaPrefix, buildAreaNamer, buildMobAreas, SPAWN_AREA_PREFIXES, type AreaMarker } from "../../../scripts/extract/mob-areas";
import { byLang } from "../../../src/lib/lang";
import { makeLocales, ns } from "../../helpers/locales";
import { areaRow, mobTables, waveRow } from "../../helpers/mob-tables";

const AREA_TABLE = "source-data/DataTables/UFS/DT_AreaDefinition.json";
const hasSourceData = existsSync(AREA_TABLE);

const locales = makeLocales({
  [ns("DT_AreaDefinition")]: {
    SW_Area_Desert_A1_SW_TextEntry_Name: { en: "Frozen Highlands", zh: "冰封高地" },
    SW_Area_Plains_A1_SW_TextEntry_Name: { en: "Creeper Woods", zh: "苦力怕森林" },
    SW_Area_Meadow_T1_SW_TextEntry_Name: { en: "Wellspring", zh: "泉源" },
    SW_Area_ZhOnly_SW_TextEntry_Name: { en: "", zh: "只有中文" },
  },
});
const tagIndex = new Map([["sw.mob.zombie", "zombie"], ["sw.mob.zombie.soulstated", "zombie"], ["sw.mob.creeper", "creeper"]]);
const markers = new Map<string, AreaMarker>([["sw.area.desert.a1", { world: "overworld", px: 6611.2, py: 4173.1 }]]);

const desert = areaRow("Desert_A1", "SW.Area.Desert.A1", ["SW.Mob.Zombie"], "SW_Area_Desert_A1_SW_TextEntry_Name");
const plains = areaRow("Plains_A1", "SW.Area.Plains.A1", [], "SW_Area_Plains_A1_SW_TextEntry_Name");

function run(areas: unknown[], waves: unknown[] = [], prefixes: Record<string, string | null> = {}) {
  const tables = mobTables({ areas, waves });
  return buildMobAreas({ tables, tagIndex, namer: buildAreaNamer(tables.areas, locales), prefixes, markers });
}

describe("areaPrefix", () => {
  it("keeps SW.Area.<Biome>.<Zone> and leaves shorter tags alone", () => {
    expect(areaPrefix("SW.Area.Meadow.T1.Rift.N")).toBe("SW.Area.Meadow.T1");
    expect(areaPrefix("Sw.Area.Ravines")).toBe("SW.Area.Ravines");
  });
});

describe("buildAreaNamer", () => {
  it("names a row from its text, and returns undefined for a missing row or English-less text", () => {
    const rows = [desert, areaRow("ZhOnly", "SW.Area.ZhOnly", [], "SW_Area_ZhOnly_SW_TextEntry_Name")];
    const namer = buildAreaNamer(mobTables({ areas: rows }).areas, locales);
    expect(namer("sw.area.desert.a1")?.en).toBe("Frozen Highlands");
    expect(namer("SW.Area.Nowhere")).toBeUndefined();
    expect(namer("SW.Area.ZhOnly")).toBeUndefined();
  });
});

describe("buildMobAreas", () => {
  it("lists a standing mob's area with its name and a map position", () => {
    const { areasBySlug } = run([desert]);
    expect(areasBySlug.get("zombie")).toEqual([
      { areaId: "SW.Area.Desert.A1", name: expect.objectContaining({ en: "Frozen Highlands", zh: "冰封高地" }), map: { world: "overworld", px: 6611.2, py: 4173.1 } },
    ]);
  });

  it("collapses near-duplicate instance rows into one area", () => {
    const north = areaRow("Meadow_T1_Rift_N", "SW.Area.Meadow.T1.Rift.N", ["SW.Mob.Creeper"]);
    const south = areaRow("Meadow_T1_Rift_S", "SW.Area.Meadow.T1.Rift.S", ["SW.Mob.Creeper"]);
    const parent = areaRow("Meadow_T1", "SW.Area.Meadow.T1", [], "SW_Area_Meadow_T1_SW_TextEntry_Name");
    const found = run([north, south, parent]).areasBySlug.get("creeper");
    expect(found?.map((area) => area.areaId)).toEqual(["SW.Area.Meadow.T1"]);
    expect(found?.[0]?.map).toBeUndefined();
  });

  it("adds arena-wave areas through the prefix map, including a Soul Corrupted wave mob", () => {
    const wave = waveRow("PlainsA1_Arena01_Mobs", ["SW.Mob.Zombie.SoulStated", "SW.Mob.Unknown", "None"]);
    const { areasBySlug, issues } = run([desert, plains], [wave], { PlainsA1: "SW.Area.Plains.A1" });
    expect(areasBySlug.get("zombie")?.map((area) => area.areaId)).toEqual(["SW.Area.Plains.A1", "SW.Area.Desert.A1"]);   // sorted by English name: Creeper Woods, Frozen Highlands
    expect(issues).toEqual([]);
  });

  it("reports an unmapped prefix once, and stays quiet about prefixes marked as ignored", () => {
    const waves = [waveRow("Zzz_A", ["SW.Mob.Zombie"]), waveRow("Zzz_B", ["SW.Mob.Zombie"]), waveRow("GimmickStress_A", ["SW.Mob.Zombie"])];
    const { issues, areasBySlug } = run([], waves, { GimmickStress: null });
    expect(issues).toEqual([{ type: "mob-area-prefix-unmapped", detail: "Zzz (2 wave rows)" }]);
    expect(areasBySlug.get("zombie")).toBeUndefined();
  });

  it("reports an area it cannot name and leaves it out", () => {
    const nameless = areaRow("Mystery_A1", "SW.Area.Mystery.A1", ["SW.Mob.Zombie"], "SW_Area_Missing_SW_TextEntry_Name");
    const { issues, areasBySlug } = run([nameless]);
    expect(issues.map((item) => item.type)).toEqual(["mob-area-unnamed"]);
    expect(areasBySlug.get("zombie")).toBeUndefined();
  });

  it("reports an unnamed area once even when several rows and waves point at it", () => {
    const rows = [areaRow("M_1", "SW.Area.Mystery.A1.One", ["SW.Mob.Zombie"], "Nope"), areaRow("M_2", "SW.Area.Mystery.A1.Two", ["SW.Mob.Creeper"], "Nope")];
    const { issues } = run(rows, [waveRow("Q_A", ["SW.Mob.Zombie"])], { Q: "SW.Area.Mystery.A1" });
    expect(issues.filter((item) => item.type === "mob-area-unnamed")).toHaveLength(1);
  });
});

describe("areaMarkers", () => {
  it("indexes area markers by tag key and skips other kinds", () => {
    const frame = { minX: 0, maxX: 1, minY: 0, maxY: 1, span: 1, ratio: 1, imageSize: 1 };
    const marker = { id: "area:sw.area.desert.a1", kind: "area", px: 1, py: 2, name: byLang(() => "x") };
    const other = { id: "merchant:foo", kind: "merchant", px: 3, py: 4, name: byLang(() => "y") };
    const map = MapDataSchema.parse({ worlds: [{ key: "overworld", name: byLang(() => "O"), frame, zMax: 0, markers: [marker, other] }], legend: {} });
    expect([...areaMarkers(map)]).toEqual([["sw.area.desert.a1", { world: "overworld", px: 1, py: 2 }]]);
  });
});

describe("spawn-area-prefixes.json", () => {
  it("maps prefixes to SW.Area tags or marks them ignored", () => {
    for (const [prefix, target] of Object.entries(SPAWN_AREA_PREFIXES)) {
      expect(prefix, "prefix").toMatch(/^[A-Za-z0-9]+$/);
      if (target !== null) expect(target, prefix).toMatch(/^SW\.Area\.[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*$/);
    }
    expect(SPAWN_AREA_PREFIXES.PlainsA1).toBe("SW.Area.Plains.A1");
    expect(SPAWN_AREA_PREFIXES.MEa2).toBe("SW.Area.Meadow.A2");
    expect(SPAWN_AREA_PREFIXES.GimmickStress).toBeNull();
  });

  it("has no entry for a DeepDarkT2 area the game does not define", () => {
    expect(SPAWN_AREA_PREFIXES.DeepDarkT2).not.toBe("SW.Area.DeepDark.T2");
  });

  it.skipIf(!hasSourceData)("only points at areas the game defines (checked against the real tables)", () => {
    const areas: { TypeTag: { TagName: string } }[] = JSON.parse(readFileSync(AREA_TABLE, "utf8").replace(/^\uFEFF/, ""));
    const known = new Set(areas.map((row) => areaPrefix(row.TypeTag.TagName).toLowerCase()));
    for (const [prefix, target] of Object.entries(SPAWN_AREA_PREFIXES)) {
      if (target !== null) expect(known.has(areaPrefix(target).toLowerCase()), `${prefix} -> ${target}`).toBe(true);
    }
  });
});
