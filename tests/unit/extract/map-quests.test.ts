import { describe, expect, it } from "vitest";
import { addQuestMarkers, questOfRow, type QuestLocationRowValue } from "../../../scripts/extract/map-quests";
import type { MapData } from "../../../scripts/extract/map-schema";
import type { Quest } from "../../../scripts/extract/quest-schema";
import { toBlocks, toImagePixel } from "../../../src/lib/map/transform";
import { loc } from "../../helpers/localized";

const OVERWORLD = { minX: -599, maxX: 444, minY: -172, maxY: 1371, span: 1544, ratio: 0.965, imageSize: 8192 };
const CAMP = { minX: -2713, maxX: -2243, minY: -173, maxY: 109, span: 472, ratio: 0.7866666666666666, imageSize: 3072 };
const MAP: MapData = {
  worlds: [
    { key: "overworld", name: loc({ en: "Overworld" }), frame: OVERWORLD, zMax: 5, markers: [{ id: "Station", kind: "minecart", px: 1, py: 1, name: loc({ en: "Station" }) }] },
    { key: "camp", name: loc({ en: "Camp" }), frame: CAMP, zMax: 4, markers: [] },
  ],
  legend: {},
};

const FOREST = { areaId: "SW.Area.Forest.A1", name: loc({ en: "Forest" }), map: { world: "overworld" as const, px: 4241.8, py: 4046.3 } };

const quest = (id: string, extra: Partial<Quest> = {}): Quest => ({
  slug: id.toLowerCase().replace(/_/g, "-"),
  id,
  section: "core",
  type: "core",
  size: null,
  replayable: false,
  title: { text: loc({ en: `Quest ${id}` }), untranslated: [] },
  description: null,
  completed: null,
  region: FOREST,
  prerequisites: [],
  unlocks: [],
  objectives: [],
  rewards: { first: [], every: [], emeralds: null },
  mobs: [],
  ...extra,
});

const row = (Name: string, X: number, Y: number, Level = "Overworld"): QuestLocationRowValue => ({
  Name,
  QuestLocationData: { Location: { X, Y, Z: 0 }, Level },
});

const everyIcon = () => true;
const questMarkers = (data: MapData, world: string) => data.worlds.find((w) => w.key === world)?.markers.filter((m) => m.kind.startsWith("quest")) ?? [];

describe("questOfRow", () => {
  const quests = [quest("CA02"), quest("CA02_B"), quest("PLa1_S04_A", { type: "side" })];

  it("picks the longest quest id that starts the tag", () => {
    expect(questOfRow("SW.QuestLocation.CA02.B.E03", quests)?.id).toBe("CA02_B");
    expect(questOfRow("SW.QuestLocation.CA02.K01", quests)?.id).toBe("CA02");
    expect(questOfRow("SW.QuestLocation.PLa1.S04.A.K01", quests)?.id).toBe("PLa1_S04_A");
  });

  it("needs a whole id segment, not a partial one", () => {
    expect(questOfRow("SW.QuestLocation.CA020.K01", quests)).toBeUndefined();
    expect(questOfRow("SW.Other.CA02.K01", quests)).toBeUndefined();
  });
});

describe("addQuestMarkers", () => {
  it("pins each spot of a quest at its game position, linked to the quest", () => {
    const { data, issues } = addQuestMarkers(MAP, [quest("CA02")], [row("SW.QuestLocation.CA02.K01", 11100, 59300)], everyIcon);
    const expected = toImagePixel(OVERWORLD, toBlocks({ X: 11100, Y: 59300 }));
    expect(questMarkers(data, "overworld")).toEqual([
      {
        id: "quest:SW.QuestLocation.CA02.K01",
        kind: "quest-main",
        px: Math.round(expected.px * 10) / 10,
        py: Math.round(expected.py * 10) / 10,
        name: loc({ en: "Quest CA02" }),
        area: FOREST.name,
        icon: "icons/map/t_ui_icon_corequestgiver_minimap.png",
        quests: [{ slug: "ca02", title: loc({ en: "Quest CA02" }) }],
      },
    ]);
    expect(issues).toEqual([]);
  });

  it("makes side quests their own kind, with the side-quest icon, and places spots in the world that contains them", () => {
    const quests = [quest("FOa1_S10_A", { type: "side" }), quest("CA00", { region: null })];
    const rows = [row("SW.QuestLocation.FOa1.S10.A.F02", 16600, 39100), row("SW.QuestLocation.CA00.K01", -260150, -9200)];
    const { data } = addQuestMarkers(MAP, quests, rows, everyIcon);
    expect(questMarkers(data, "overworld").map((m) => [m.kind, m.icon])).toEqual([["quest-side", "icons/map/t_ui_icon_sidequestgiver_minimap.png"]]);
    expect(questMarkers(data, "camp").map((m) => [m.id, m.area])).toEqual([["quest:SW.QuestLocation.CA00.K01", undefined]]);
  });

  it("merges a quest's spots that sit on top of each other", () => {
    const rows = [row("SW.QuestLocation.CA02.E01", 11100, 59300), row("SW.QuestLocation.CA02.E02", 11110, 59300), row("SW.QuestLocation.CA02.E03", 23700, 35600)];
    const { data } = addQuestMarkers(MAP, [quest("CA02")], rows, everyIcon);
    expect(questMarkers(data, "overworld").map((m) => m.id)).toEqual(["quest:SW.QuestLocation.CA02.E01", "quest:SW.QuestLocation.CA02.E03"]);
  });

  it("reports spots in other levels, off every map, or named after no published quest", () => {
    const rows = [
      row("SW.QuestLocation.CA02.B.E05", 10100, 6400, "SpiderCaveV3"),
      row("SW.QuestLocation.CA02.E07", -57750, 153560),
      row("SW.QuestLocation.ZZ99.K01", 11100, 59300),
    ];
    const { data, issues } = addQuestMarkers(MAP, [quest("CA02")], rows, everyIcon);
    expect(issues.map((i) => [i.type, i.detail])).toEqual([
      ["quest-location-off-map", "SW.QuestLocation.CA02.B.E05 (SpiderCaveV3)"],
      ["quest-location-off-map", "SW.QuestLocation.CA02.E07 (Overworld)"],
      ["quest-location-unmatched", "SW.QuestLocation.ZZ99.K01"],
    ]);
    // With no spot on the map, the quest falls back to its area.
    expect(questMarkers(data, "overworld").map((m) => m.kind)).toEqual(["quest-main"]);
  });

  it("gathers quests without spots into a main and a side pin per area, named by the base area", () => {
    const fortress = { ...FOREST, areaId: "SW.Area.Forest.A1.Inside", name: loc({ en: "Inside" }) };
    const quests = [quest("CA03"), quest("FOa1_S08_A", { type: "side", region: fortress }), quest("CT_S01_A", { region: null })];
    const { data } = addQuestMarkers(MAP, quests, [], everyIcon);
    expect(questMarkers(data, "overworld")).toEqual([
      {
        id: "quest-area:sw.area.forest.a1:main",
        kind: "quest-main",
        // Both kinds at one spot: main a little to the left, side to the right.
        px: 4225.8,
        py: 4046.3,
        name: FOREST.name,
        icon: "icons/map/t_ui_icon_corequestgiver_minimap.png",
        quests: [{ slug: "ca03", title: loc({ en: "Quest CA03" }) }],
      },
      {
        id: "quest-area:sw.area.forest.a1:side",
        kind: "quest-side",
        px: 4257.8,
        py: 4046.3,
        name: FOREST.name,
        icon: "icons/map/t_ui_icon_sidequestgiver_minimap.png",
        quests: [{ slug: "foa1-s08-a", title: loc({ en: "Quest FOa1_S08_A" }) }],
      },
    ]);
  });

  it("keeps an area's single quest type on the spot, unshifted", () => {
    const { data } = addQuestMarkers(MAP, [quest("FOa1_S08_A", { type: "side" })], [], everyIcon);
    expect(questMarkers(data, "overworld").map((m) => [m.id, m.kind, m.px])).toEqual([["quest-area:sw.area.forest.a1:side", "quest-side", 4241.8]]);
  });

  it("keeps the other markers and the kind order, and leaves the input map unchanged", () => {
    const { data } = addQuestMarkers(MAP, [quest("CA03")], [], () => false);
    expect(data.worlds[0].markers.map((m) => m.kind)).toEqual(["minecart", "quest-main"]);
    expect(data.worlds[0].markers[1].icon).toBeUndefined();
    expect(MAP.worlds[0].markers).toHaveLength(1);
  });
});
