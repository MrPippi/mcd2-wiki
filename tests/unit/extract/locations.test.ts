import { existsSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadLocationTables } from "../../../scripts/extract/location-tables";
import { LocationDataSchema, type Location, type RegionList } from "../../../scripts/extract/location-schema";
import {
  buildLocationData,
  extractLocations,
  joinLocations,
  levelsOf,
  parseRegionList,
  REGION_LIST,
  type BuildContext,
  type Joins,
  type LocationsInput,
} from "../../../scripts/extract/locations";
import type { MapData } from "../../../scripts/extract/map-schema";
import type { ItemSourcesData, Mob, MobArea } from "../../../scripts/extract/mob-schema";
import type { Quest, QuestData } from "../../../scripts/extract/quest-schema";
import { localizedFrom } from "../../../src/lib/lang";
import { makeSparseLocales, ns } from "../../helpers/locales";
import { AREA_ICON, locationRow, MAP_PIN, progressionRow } from "../../helpers/location-tables";

const LIST: RegionList = {
  regions: [
    { slug: "howling-woods", areas: ["SW.Area.Forest.A1"] },
    { slug: "the-deep-dark", areas: ["SW.Area.DeepDark.A1", "SW.Area.DeepDark.A2"], members: ["SW.Area.DeepDark"] },
    { slug: "squid-coast", areas: ["SW.Area.Camp.A1"] },
    { slug: "ghost-town", areas: ["SW.Area.Ghost"] },
  ],
  excluded: { "SW.Area.Test.*": "test levels" },
};

const LOCALES = makeSparseLocales({
  [ns("DT_AreaDefinition")]: {
    Forest: { en: "Howling Woods", zh: "咆哮森林", de: "Heulwälder" },
    Hut: { en: "Witch's Hut", zh: "女巫小屋" },
    DeepDark: { en: "The Deep Dark", zh: "深淵" },
    Dungeon: { en: "Dungeon", zh: "地下城" },
    Camp: { en: "Squid Coast", zh: "魷魚海岸" },
  },
});

const TABLES = {
  areas: [
    locationRow("Forest_A1", "SW.Area.Forest.A1", { key: "Forest", icon: AREA_ICON("T_UI_Icon_HowlingWoods"), progression: "SW.Progression.Forest.A1.Start" }),
    locationRow("WitchInt", "SW.Area.Forest.A1.WitchInt", { key: "Hut", icon: AREA_ICON("T_UI_Icon_HowlingWoods") }),
    locationRow("DeepDarkA1", "SW.Area.DeepDark.A1", { key: "DeepDark", icon: MAP_PIN, progression: "SW.Progression.DeepDark.A1.Start" }),
    locationRow("DeepDarkA2", "SW.Area.DeepDark.A2", { key: "DeepDark", icon: MAP_PIN, progression: "SW.Progression.DeepDark.A2.Start" }),
    locationRow("Dungeon_1", "SW.Area.DeepDark.Dungeons.1", { key: "Dungeon" }),
    locationRow("Dungeon_2", "SW.Area.DeepDark.Dungeons.2", { key: "Dungeon" }),
    locationRow("CampA1", "SW.Area.Camp.A1", { key: "Camp", icon: AREA_ICON("T_UI_Icon_Missing"), progression: "SW.Progression.None" }),
    locationRow("Gym", "SW.Area.Test.Gym"),
  ],
  progression: [
    progressionRow("SW.Progression.None", 1),
    progressionRow("SW.Progression.Forest.A1.Start", 6),
    progressionRow("SW.Progression.DeepDark.A1.Start", 14),
    progressionRow("SW.Progression.DeepDark.A2.Start", 45),
  ],
};

const MARKERS = new Map([["sw.area.forest.a1", { world: "overworld" as const, px: 10, py: 20 }]]);
const CTX: BuildContext = {
  locales: LOCALES,
  markers: MARKERS,
  levels: levelsOf(TABLES.progression),
  iconFile: (reference) => (reference.includes("HowlingWoods") ? "/src/HowlingWoods.png" : undefined),
};

const area = (areaId: string): MobArea => ({ areaId, name: localizedFrom(() => areaId) });
const mob = (slug: string, kind: Mob["kind"], areas: string[]): Mob => ({
  slug, id: slug, kind, world: null, name: localizedFrom(() => slug), untranslated: [], stats: [], variants: [], areas: areas.map(area), drops: [],
});
const quest = (slug: string, region: string | null) => ({ slug, region: region === null ? null : area(region) }) as unknown as Quest;
const noSources = { kind: "area" as const, name: localizedFrom(() => "x"), untranslated: [] };
const JOINS: Joins = {
  mobs: { mobs: [mob("maw", "boss", ["SW.Area.DeepDark.T1"]), mob("zombie", "regular", ["SW.Area.Forest.A1", "SW.Area.DeepDark.A1"]), mob("ghost", "regular", ["SW.Area.Nowhere"])] },
  quests: { quests: [quest("ca02", "SW.Area.Forest.A1"), quest("ca02-b", "SW.Area.Forest.A1.WitchInt"), quest("ct-s01-a", null)], rewardSources: {} } as QuestData,
  sources: { sources: { "area:SW.Area.Forest.A1": noSources, "area:SW.Area.Test.Gym": noSources, "chest:Fancy": noSources }, items: {} } as unknown as ItemSourcesData,
};

const built = buildLocationData(TABLES, LIST, JOINS, CTX);
const location = (slug: string): Location | undefined => built.data.locations.find((one) => one.slug === slug);

describe("buildLocationData", () => {
  it("validates against the output schema and keeps the region list's order", () => {
    expect(LocationDataSchema.safeParse(built.data).success).toBe(true);
    expect(built.data.locations.map((one) => one.slug)).toEqual(["howling-woods", "the-deep-dark", "squid-coast"]);
  });

  it("names a region from its first own row, in every language, with its English stand-ins", () => {
    const woods = location("howling-woods");
    expect(woods?.name.zh).toBe("咆哮森林");
    expect(woods?.untranslated).toContain("ja");
    expect(woods?.untranslated).not.toContain("de");
    expect(built.issues).toContainEqual(expect.objectContaining({ type: "location-text-fallback", detail: expect.stringMatching(/^howling-woods: Howling Woods: /) }));
  });

  it("reports a listed region with no row and leaves it out", () => {
    expect(built.issues).toContainEqual({ type: "location-region-missing", detail: "ghost-town: no row for SW.Area.Ghost" });
  });

  it("takes the levels of every own row, ascending, and reports a region without one", () => {
    expect(location("howling-woods")?.levels).toEqual([6]);
    expect(location("the-deep-dark")?.levels).toEqual([14, 45]);
    expect(location("squid-coast")?.levels).toEqual([]);
    expect(built.issues).toContainEqual({ type: "location-no-level", detail: "squid-coast: SW.Area.Camp.A1 has no progression" });
  });

  it("publishes only game area icons that exist and reports the rest", () => {
    expect(location("howling-woods")?.icon).toBe("icons/locations/howling-woods.png");
    expect(built.icons).toEqual([{ from: "/src/HowlingWoods.png", published: "icons/locations/howling-woods.png" }]);
    expect(location("the-deep-dark")?.icon).toBeUndefined();
    expect(built.issues).toContainEqual({ type: "location-no-icon", detail: `the-deep-dark: ${MAP_PIN} is not an area icon` });
    expect(built.issues).toContainEqual(expect.objectContaining({ type: "location-no-icon", detail: expect.stringMatching(/^squid-coast: .* has no file$/) }));
  });

  it("gives the map marker of an own row when the map has one", () => {
    expect(location("howling-woods")?.map).toEqual({ world: "overworld", px: 10, py: 20 });
    expect(location("the-deep-dark")?.map).toBeUndefined();
  });

  it("folds the sub-locations by name, keeping every tag", () => {
    expect(location("the-deep-dark")?.subLocations.map((line) => [line.name.en, line.areaIds.length])).toEqual([["Dungeon", 2]]);
    expect(location("howling-woods")?.subLocations.map((line) => line.name.zh)).toEqual(["女巫小屋"]);
  });

  it("reports excluded rows", () => {
    expect(built.issues).toContainEqual({ type: "location-excluded", detail: "SW.Area.Test.Gym (Gym): test levels" });
  });
});

describe("joinLocations", () => {
  it("places mobs, quests and area loot pools in the region that owns their area, each once", () => {
    expect(location("howling-woods")?.mobs).toEqual(["zombie"]);
    expect(location("the-deep-dark")?.mobs).toEqual(["maw", "zombie"]);
    expect(location("howling-woods")?.quests).toEqual(["ca02", "ca02-b"]);
    expect(location("howling-woods")?.lootSources).toEqual(["area:SW.Area.Forest.A1"]);
  });

  it("indexes every joined area id to its location", () => {
    expect(built.data.areas).toEqual({
      "SW.Area.DeepDark.T1": "the-deep-dark",
      "SW.Area.Forest.A1": "howling-woods",
      "SW.Area.DeepDark.A1": "the-deep-dark",
      "SW.Area.Forest.A1.WitchInt": "howling-woods",
    });
  });

  it("reports an area no published location owns", () => {
    expect(built.issues).toContainEqual({ type: "location-area-unowned", detail: "mob ghost: SW.Area.Nowhere" });
    expect(built.issues).toContainEqual({ type: "location-area-unowned", detail: "loot area:SW.Area.Test.Gym: SW.Area.Test.Gym" });
  });

  it("leaves a location that nothing joins with empty lists", () => {
    const empty = joinLocations(LIST, [location("squid-coast") as Location], { ...JOINS, mobs: { mobs: [] }, quests: { quests: [], rewardSources: {} } });
    expect(empty.data.locations[0]).toMatchObject({ mobs: [], quests: [], lootSources: [] });
  });
});

describe("the region list", () => {
  it("parses the hand-kept file", () => {
    expect(REGION_LIST.regions.length).toBeGreaterThanOrEqual(12);
    expect(new Set(REGION_LIST.regions.map((one) => one.slug)).size).toBe(REGION_LIST.regions.length);
  });

  it("refuses a malformed list", () => {
    expect(() => parseRegionList({ regions: [{ slug: "Bad Slug", areas: [] }], excluded: {} })).toThrow(/地區清單格式錯誤/);
  });
});

async function sourceWith(tables: Record<string, unknown>, files: Record<string, string> = {}): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "mcd2-locations-"));
  const dir = path.join(root, "DataTables", "UFS");
  await mkdir(dir, { recursive: true });
  for (const [name, rows] of Object.entries(tables)) await writeFile(path.join(dir, `${name}.json`), JSON.stringify(rows), "utf8");
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), content);
  }
  return root;
}

const MAP: MapData = { worlds: [], legend: {} } as unknown as MapData;
const input = (sourceRoot: string, outRoot: string): LocationsInput => ({
  sourceRoot, outRoot, locales: LOCALES, map: MAP, mobs: JOINS.mobs, quests: JOINS.quests, sources: JOINS.sources, regions: LIST,
});

describe("loadLocationTables / extractLocations", () => {
  it("returns empty data and the missing-table issue without the area table", async () => {
    const root = await sourceWith({});
    const result = await extractLocations(input(root, root));
    expect(result.data).toEqual({ locations: [], areas: {} });
    expect(result.issues).toEqual([{ type: "missing-location-tables", detail: "DT_AreaDefinition.json" }]);
    expect(result.tablesRead).toEqual([]);
  });

  it("reports a missing progression table and builds without levels", async () => {
    const root = await sourceWith({ DT_AreaDefinition: TABLES.areas });
    const loaded = await loadLocationTables(root);
    expect(loaded.issues).toEqual([{ type: "missing-location-tables", detail: "DT_ProgressionDefinition.json" }]);
    expect(loaded.tables?.progression).toEqual([]);
  });

  it("refuses a table whose fields changed", async () => {
    const root = await sourceWith({ DT_AreaDefinition: [{ Name: 1 }] });
    await expect(loadLocationTables(root)).rejects.toThrow(/地區資料表欄位與預期不符/);
  });

  it("reads both tables, builds the data and copies the area icons into public/icons/locations", async () => {
    const root = await sourceWith(
      { DT_AreaDefinition: TABLES.areas, DT_ProgressionDefinition: TABLES.progression },
      { "Assets/UI/Icons/Location/AreaIcons/T_UI_Icon_HowlingWoods.png": "png" },
    );
    const out = await mkdtemp(path.join(tmpdir(), "mcd2-locations-out-"));
    const result = await extractLocations(input(root, out));
    expect([...result.tablesRead].sort()).toEqual(["DT_AreaDefinition.json", "DT_ProgressionDefinition.json"]);   // read in parallel
    expect(result.data.locations.find((one) => one.slug === "howling-woods")?.levels).toEqual([6]);
    expect(existsSync(path.join(out, "public", "icons", "locations", "howling-woods.png"))).toBe(true);
  });
});
