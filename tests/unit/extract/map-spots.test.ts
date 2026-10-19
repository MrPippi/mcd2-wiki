import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { MapData } from "../../../shared/map-schema";
import { addSpotMarkers, chestTalismans, loadMapSpots, type MapSpotsData } from "../../../scripts/extract/map-spots";
import { toBlocks, toImagePixel } from "../../../shared/map/transform";
import { makeEntry } from "../../helpers/entries";
import { guideTables } from "../../helpers/guide-tables";
import { loc } from "../../helpers/localized";

const OVERWORLD = { minX: -599, maxX: 444, minY: -172, maxY: 1371, span: 1544, ratio: 0.965, imageSize: 8192 };
const SIFT = { minX: -1093, maxX: -539, minY: 1552, maxY: 2894, span: 1344, ratio: 0.96, imageSize: 7168 };
const MAP: MapData = {
  worlds: [
    { key: "overworld", name: loc({ en: "Overworld" }), frame: OVERWORLD, zMax: 5, markers: [{ id: "Station", kind: "minecart", px: 1, py: 1, name: loc({ en: "Station" }) }] },
    { key: "sift", name: loc({ en: "Sift" }), frame: SIFT, zMax: 5, markers: [] },
  ],
  legend: {},
};
const FOREST = loc({ en: "Howling Woods" });
const MEADOW = loc({ en: "Singer's Meadow" });
const areas: Readonly<Record<string, ReturnType<typeof loc>>> = { "SW.Area.Forest.A1": FOREST, "SW.Area.Meadow.A1": MEADOW };
const areaName = (tag: string) => areas[tag];
const clover = makeEntry("Talisman_DoubleDrop", "talisman", { name: loc({ en: "Lucky Clover" }) });

const SPOTS: MapSpotsData = {
  storm: [
    { area: "SW.Area.Forest.A1", slot: 1, x: 22850, y: 61850 },
    { area: "SW.Area.Meadow.A1", slot: 4, x: -57250, y: 161950 },
  ],
  talismanChests: [{ chest: "DoubleDrop", x: 29450, y: 118500 }],
  dungeons: [
    { doorway: "SW.Doorway.ForestA1.Dungeon.2", size: "Small", x: 5750, y: 104250 },
    { doorway: "SW.Doorway.MeadowA1.Dungeon.7", size: "Large", x: -85150, y: 183250 },
  ],
};
const input = (spots = SPOTS, iconExists = () => true) => ({ spots, areaName, talismans: new Map([["doubledrop", clover]]), iconExists });
const markers = (data: MapData, world: string) => data.worlds.find((w) => w.key === world)?.markers ?? [];

describe("addSpotMarkers", () => {
  it("places storm slots, chests and dungeons in the world that contains them, with the shared transform", () => {
    const { data, issues } = addSpotMarkers(MAP, input());
    const expected = toImagePixel(OVERWORLD, toBlocks({ X: 22850, Y: 61850 }));
    const slot = markers(data, "overworld").find((m) => m.id === "storm:sw.area.forest.a1:1");
    expect(slot).toMatchObject({ kind: "storm", name: FOREST, icon: "icons/map/t_ui_icon_storminator.png" });
    expect(slot?.px).toBeCloseTo(expected.px, 0);
    expect(slot?.py).toBeCloseTo(expected.py, 0);
    expect(markers(data, "sift").map((m) => m.id)).toEqual(["storm:sw.area.meadow.a1:4", "dungeon:sw.doorway.meadowa1.dungeon.7"]);
    expect(issues).toEqual([]);
  });

  it("names a dungeon after its area, taken from the doorway tag", () => {
    const { data } = addSpotMarkers(MAP, input());
    expect(markers(data, "overworld").find((m) => m.kind === "dungeon")).toMatchObject({
      id: "dungeon:sw.doorway.foresta1.dungeon.2",
      name: FOREST,
      icon: "icons/map/t_ui_icon_dungeon_lv1.png",
    });
  });

  it("links a talisman chest to its talisman entry and names it after the talisman", () => {
    const { data } = addSpotMarkers(MAP, input());
    expect(markers(data, "overworld").find((m) => m.kind === "talisman-chest")).toMatchObject({
      id: "talisman-chest:doubledrop",
      name: clover.name,
      entry: { category: "talisman", slug: clover.slug },
      icon: "icons/map/t_ui_icon_chest.png",
    });
  });

  it("keeps the kind order and leaves the input map unchanged", () => {
    const { data } = addSpotMarkers(MAP, input());
    expect(markers(data, "overworld").map((m) => m.kind)).toEqual(["minecart", "storm", "talisman-chest", "dungeon"]);
    expect(MAP.worlds[0].markers).toHaveLength(1);
  });

  it("reports spots with no area name, an unlinked chest or no world, and skips them", () => {
    const spots: MapSpotsData = {
      storm: [
        { area: "SW.Area.Nowhere", slot: 1, x: 22850, y: 61850 },
        { area: "SW.Area.Forest.A1", slot: 2, x: 99999999, y: 0 },
      ],
      talismanChests: [{ chest: "Mystery", x: 1, y: 1 }],
      dungeons: [{ doorway: "SW.Doorway.Odd", size: "Small", x: 1, y: 1 }],
    };
    const { data, issues } = addSpotMarkers(MAP, input(spots));
    expect(issues.map((i) => [i.type, i.detail])).toEqual([
      ["map-spot-unnamed", "storm: SW.Area.Nowhere"],
      ["map-chest-unlinked", "Mystery"],
      ["map-spot-unnamed", "dungeon: SW.Doorway.Odd"],
      ["map-spot-off-map", "storm:sw.area.forest.a1:2"],
    ]);
    expect(markers(data, "overworld")).toHaveLength(1);
  });

  it("leaves icons off when the files are missing", () => {
    const { data } = addSpotMarkers(MAP, input(SPOTS, () => false));
    expect(markers(data, "overworld").some((m) => m.icon !== undefined)).toBe(false);
  });
});

describe("chestTalismans", () => {
  const entries = [clover, makeEntry("Talisman_RangedBuff", "talisman")];

  it("maps each TalismansChest row to the talisman it guarantees", () => {
    const found = chestTalismans(guideTables(), entries);
    expect([...found].map(([chest, entry]) => [chest, entry.id])).toEqual([
      ["doubledrop", "Talisman_DoubleDrop"],
      ["rangedbuff", "Talisman_RangedBuff"],
    ]);
  });

  it("skips a chest whose talisman has no entry", () => {
    expect([...chestTalismans(guideTables(), [clover]).keys()]).toEqual(["doubledrop"]);
  });
});

describe("loadMapSpots", () => {
  let dir: string | undefined;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("returns undefined when source-data has no spots file", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "spots-"));
    expect(await loadMapSpots(dir)).toBeUndefined();
  });

  it("reads a valid file and rejects one in the wrong shape", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "spots-"));
    await mkdir(path.join(dir, "MapSpots"));
    await writeFile(path.join(dir, "MapSpots", "map-spots.json"), JSON.stringify(SPOTS));
    expect(await loadMapSpots(dir)).toEqual(SPOTS);
    await writeFile(path.join(dir, "MapSpots", "map-spots.json"), JSON.stringify({ storm: [{ area: 1 }] }));
    await expect(loadMapSpots(dir)).rejects.toThrow(/map-spots/);
  });
});
