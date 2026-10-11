import { describe, expect, it } from "vitest";
import { buildRotation, buildSchedule, parseUeTimestamp } from "../../../scripts/extract/soul-storm-schedule-data";
import { areaRow } from "../../helpers/mob-tables";
import { realSoulStormTables, rotationRow, scheduleRow } from "../../helpers/soul-storm-tables";
import { makeSparseLocales as locales } from "../../helpers/locales";

describe("parseUeTimestamp", () => {
  it("reads the game's timestamp as UTC", () => {
    expect(parseUeTimestamp("2026.01.01-00.00.00", 0)).toBe("2026-01-01T00:00:00.000Z");
  });
  it("shifts by the configured offset when the anchor is local time", () => {
    expect(parseUeTimestamp("2026.01.01-00.00.00", 480)).toBe("2025-12-31T16:00:00.000Z");
    expect(parseUeTimestamp("2026.01.01-00.00.00", -300)).toBe("2026-01-01T05:00:00.000Z");
  });
  it("refuses anything else", () => {
    for (const bad of ["2026-01-01T00:00:00Z", "2026.13.01-00.00.00", "2026.01.01", ""]) expect(() => parseUeTimestamp(bad, 0), bad).toThrow();
  });
  it("refuses a day that does not exist", () => {
    expect(() => parseUeTimestamp("2026.02.30-00.00.00", 0)).toThrow();
  });
});

describe("buildSchedule", () => {
  const status = { verified: false, anchorOffsetMinutes: 0, rotationOffset: 0 };
  it("keeps the raw values and the computed anchor", () => {
    expect(buildSchedule(realSoulStormTables().schedule[0], status)).toEqual({
      anchorRaw: "2026.01.01-00.00.00", anchorUtc: "2026-01-01T00:00:00.000Z", anchorOffsetMinutes: 0,
      durationSeconds: 1200, cadenceSeconds: 2400, rotationOffset: 0,
    });
  });
  it("refuses a storm longer than its cadence", () => {
    const row = realSoulStormTables().schedule[0];
    expect(() => buildSchedule({ ...row, DurationInSeconds: 2400 }, status)).toThrow();
  });
  it("refuses a storm with no length", () => {
    const row = realSoulStormTables().schedule[0];
    expect(() => buildSchedule({ ...row, DurationInSeconds: 0 }, status)).toThrow();
  });
  it("uses the row built by the helper too", () => {
    expect(buildSchedule(scheduleRow("2026.03.01-12.30.00"), status).anchorUtc).toBe("2026-03-01T12:30:00.000Z");
  });
});

describe("buildRotation", () => {
  const areas = [
    areaRow("Forest_A1", "SW.Area.Forest.A1", []),
    areaRow("Carapace_A1", "SW.Area.Carapace.A1", [], "SW_Area_Carapace_A1_SW_TextEntry_Name"),
  ];
  const loc = locales({
    "Text/Release/DT_AreaDefinition.csv": {
      SW_Area_Forest_A1_SW_TextEntry_Name: { en: "Howling Woods", zh: "咆哮森林", ja: "遠吠えの森" },
      SW_Area_Carapace_A1_SW_TextEntry_Name: { en: "Humbler Huskland", zh: "轟鳴蟲殼骸之地" },
    },
  });
  const markers = new Map([["sw.area.carapace.a1", { world: "sift" as const, px: 3316.9, py: 5462.7 }]]);

  it("keeps the table order, names each area and places it on the map", () => {
    const result = buildRotation(rotationRow(["SW.Area.Carapace.A1", "SW.Area.Forest.A1"]), areas, loc, markers);
    expect(result.rotation.map((area) => area.name.en)).toEqual(["Humbler Huskland", "Howling Woods"]);
    expect(result.rotation[0].map).toEqual({ world: "sift", px: 3316.9, py: 5462.7 });
    expect(result.rotation[1].map).toBeUndefined();
  });

  it("marks the whole list once for each language that fell back to English", () => {
    const result = buildRotation(rotationRow(["SW.Area.Carapace.A1", "SW.Area.Forest.A1"]), areas, loc, markers);
    expect(result.untranslated).toContain("ja");      // Carapace has no ja
    expect(result.untranslated).not.toContain("zh");
    expect(result.rotation[0].name.ja).toBe("Humbler Huskland");
  });

  it("reports an area with no name and shows its tag in English", () => {
    const result = buildRotation(rotationRow(["SW.Area.Plains.A9"]), areas, loc, markers);
    expect(result.issues).toEqual([{ type: "soul-storm-area-unnamed", detail: "SW.Area.Plains.A9" }]);
    expect(result.rotation[0].name.zh).toBe("Plains A9");
    expect(result.untranslated).toHaveLength(15);
  });
});
