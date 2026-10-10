import { describe, expect, it } from "vitest";
import { buildMapData } from "../../../scripts/extract/map";
import type { MapMarker } from "../../../scripts/extract/map-schema";
import { toBlocks, toImagePixel } from "../../../src/lib/map/transform";
import { MAP_LOCALES, MAP_TABLES } from "../../helpers/map-tables";

const everyIcon = () => true;
const noIcon = () => false;
const run = (tables = MAP_TABLES, iconExists = everyIcon) => buildMapData(tables, MAP_LOCALES, iconExists);
const markersOf = (world: string, tables = MAP_TABLES, iconExists = everyIcon): MapMarker[] =>
  run(tables, iconExists).data.worlds.find((w) => w.key === world)?.markers ?? [];
const byId = (world: string, id: string) => markersOf(world).find((m) => m.id === id);

describe("buildMapData", () => {
  it("lists the worlds in display order with their names, frames and top zoom", () => {
    const { worlds } = run().data;
    expect(worlds.map((w) => [w.key, w.name.zh, w.zMax])).toEqual([
      ["overworld", "主世界", 5],
      ["sift", "隙浮", 5],
      ["camp", "營地", 4],
    ]);
    expect(worlds[0].frame).toEqual({ minX: -599, maxX: 444, minY: -172, maxY: 1371, span: 1544, ratio: 0.965, imageSize: 8192 });
  });

  it("places the teleport statue, with its area and icon", () => {
    expect(byId("overworld", "Townportal_portal")).toEqual({
      id: "Townportal_portal",
      kind: "portal",
      px: 432.6,
      py: 4416.3,
      name: { zh: "傳送雕像", en: "Teleport Statue" },
      area: { zh: "英雄港", en: "Brave Haven" },
      icon: "icons/map/t_ui_icon_town_portal.png",
    });
  });

  it("leaves out the players' standing spots and debug points", () => {
    const ids = markersOf("overworld").map((m) => m.id);
    expect(ids).not.toContain("Townportal_player1");
    expect(ids).not.toContain("DebugRift");
  });

  it("places merchants with the game's name and map tooltip", () => {
    expect(byId("overworld", "TheTownBlacksmithComplete")).toEqual({
      id: "TheTownBlacksmithComplete",
      kind: "merchant",
      px: 357.9,
      py: 4282.8,
      name: { zh: "鐵匠", en: "Blacksmith" },
      note: { zh: "強化裝備。", en: "Upgrade your gear." },
    });
  });

  it("places rifts with the game's rift label, area and description", () => {
    expect(byId("overworld", "Rift1")).toMatchObject({
      kind: "rift",
      name: { zh: "裂隙", en: "Rift" },
      area: { zh: "咆哮森林", en: "Howling Woods" },
      note: { zh: "進入以尋找戰利品。", en: "Enter to find loot." },
    });
  });

  it("names minecart stations after their area and matches teleport tags in any case", () => {
    expect(byId("overworld", "ForestA1-Outpost")).toMatchObject({ kind: "minecart", name: { zh: "咆哮森林", en: "Howling Woods" } });
    expect(byId("overworld", "ForestA1-Outpost")?.area).toBeUndefined();
    expect(markersOf("sift").find((m) => m.id === "CarapaceA1-North")).toMatchObject({ kind: "minecart" });
  });

  it("reports and skips stations that cannot be placed or named", () => {
    const { issues } = run();
    expect(issues).toContainEqual({ type: "map-unmatched-tag", detail: "Missing → SW.TeleportPoint.Missing.MinecartStation" });
    expect(issues).toContainEqual({ type: "map-marker-outside", detail: "minecart:Lost" });
    expect(issues).toContainEqual({ type: "map-missing-name", detail: "minecart:Nowhere" });
    const ids = markersOf("overworld").map((m) => m.id);
    expect(ids).not.toContain("Lost");
    expect(ids).not.toContain("Nowhere");
  });

  it("labels each area at the average of its points", () => {
    const forest = byId("overworld", "area:sw.area.forest.a1");
    const points = [toBlocks({ X: 16300, Y: 43800 }), toBlocks({ X: 13100, Y: 61100 })].map((b) =>
      toImagePixel(run().data.worlds[0].frame, b),
    );
    expect(forest).toMatchObject({ kind: "area", name: { zh: "咆哮森林", en: "Howling Woods" } });
    expect(forest?.px).toBeCloseTo((points[0].px + points[1].px) / 2, 1);
    expect(forest?.py).toBeCloseTo((points[0].py + points[1].py) / 2, 1);
    expect(forest?.icon).toBeUndefined();
    expect(byId("overworld", "area:sw.area.town")).toMatchObject({ px: 432.6, py: 4416.3, icon: "icons/map/t_ui_icon_bravehaven.png" });
    expect(markersOf("overworld").find((m) => m.id === "area:sw.area.unknown")).toBeUndefined();
  });

  it("lists the icons to copy, once each", () => {
    expect(run().icons).toEqual([
      { from: "Assets/UI/Icons/Location/AreaIcons/T_UI_Icon_Town_Portal.png", published: "icons/map/t_ui_icon_town_portal.png" },
      { from: "Assets/UI/Icons/Location/AreaIcons/T_UI_Icon_BraveHaven.png", published: "icons/map/t_ui_icon_bravehaven.png" },
    ]);
  });

  it("leaves icons out when the files are missing", () => {
    expect(run(MAP_TABLES, noIcon).icons).toEqual([]);
    expect(markersOf("overworld", MAP_TABLES, noIcon).some((m) => m.icon !== undefined)).toBe(false);
  });

  it("orders markers by kind, then id", () => {
    const kinds = markersOf("overworld").map((m) => m.kind);
    expect(kinds).toEqual([...kinds].sort((a, b) => ["minecart", "rift", "portal", "merchant", "area"].indexOf(a) - ["minecart", "rift", "portal", "merchant", "area"].indexOf(b)));
  });

  it("reports a world whose region row is missing and leaves it out", () => {
    const tables = { ...MAP_TABLES, regions: MAP_TABLES.regions.filter((r) => r.Name !== "Camp") };
    const result = run(tables);
    expect(result.data.worlds.map((w) => w.key)).toEqual(["overworld", "sift"]);
    expect(result.issues).toContainEqual({ type: "missing-map-tables", detail: "DT_WorldRegionMapData › Camp" });
  });

  it("does not change its input", () => {
    const copy = structuredClone(MAP_TABLES);
    run();
    expect(MAP_TABLES).toEqual(copy);
  });
});
