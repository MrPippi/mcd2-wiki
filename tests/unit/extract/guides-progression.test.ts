import { describe, expect, it } from "vitest";
import { buildStages, stageAreaTag } from "../../../scripts/extract/guides-progression";
import { guideTables } from "../../helpers/guide-tables";
import { makeSparseLocales } from "../../helpers/locales";

const AREA = "Text/Release/DT_AreaDefinition.csv";
const locales = makeSparseLocales({
  [AREA]: {
    SW_Area_Town_SW_TextEntry_Name: { en: "Brave Haven", zh: "英雄港" },
    SW_Area_Plains_A1_SW_TextEntry_Name: { en: "Honeycomb Fields", zh: "蜂巢原野", ja: "ハニカム平原" },
  },
});

describe("stageAreaTag", () => {
  it("maps an area's start (or the town's first visit) to the area tag", () => {
    expect(stageAreaTag("SW.Progression.Plains.A1.Start")).toBe("SW.Area.Plains.A1");
    expect(stageAreaTag("SW.Progression.Town.FirstVisit")).toBe("SW.Area.Town");
  });
  it("has no area for other stages", () => {
    expect(stageAreaTag("SW.Progression.Forest.A1.Outpost")).toBeUndefined();
    expect(stageAreaTag("SW.Progression.Maw")).toBeUndefined();
    expect(stageAreaTag("SW.Progression.Start")).toBeUndefined();
    expect(stageAreaTag("SW.Other.Plains.A1.Start")).toBeUndefined();
  });
});

describe("buildStages", () => {
  it("names the stages that start an area with a game name and reports the rest", () => {
    const { stages, issues } = buildStages(guideTables(), locales);
    expect(stages.map((stage) => [stage.id, stage.level, stage.name.html.en])).toEqual([["Town", 1, "Brave Haven"], ["PlainsStart", 2, "Honeycomb Fields"]]);
    expect(stages[1].name.html.ja).toBe("ハニカム平原");
    expect(stages[0].name.untranslated).toContain("ja");
    expect(issues.filter((item) => item.type === "guides-stage-unnamed").map((item) => item.detail.split(" ")[0])).toEqual(["NoProgression", "ForestA1Outpost", "Maw", "DesertStart"]);
  });

  it("reports an area whose name has no English text", () => {
    const { issues } = buildStages(guideTables(), makeSparseLocales({ [AREA]: { SW_Area_Town_SW_TextEntry_Name: { zh: "英雄港" } } }));
    expect(issues.some((item) => item.type === "guides-text-fallback")).toBe(true);
  });
});
