import { describe, expect, it } from "vitest";
import { dedupeByName } from "../../../scripts/extract/dedupe";
import { makeEntry } from "../../helpers/entries";
import { loc } from "../../helpers/localized";

const name = loc({ zh: "腐化苦力怕披風", en: "Corrupted Creeper Cape" });

describe("dedupeByName", () => {
  it("keeps the same-named cosmetic that has an icon and reports the other", () => {
    const { entries, issues } = dedupeByName([
      makeEntry("Cosmetic_Cape_Creeper", "cape", { name }),
      makeEntry("Cosmetic_Cape_CorruptedCreeper", "cape", { name, icon: "icons/cape/corrupted-creeper.png" }),
    ]);
    expect(entries.map((entry) => entry.id)).toEqual(["Cosmetic_Cape_CorruptedCreeper"]);
    expect(issues).toEqual([
      { type: "duplicate-entry", detail: "cape:Cosmetic_Cape_Creeper (same name as Cosmetic_Cape_CorruptedCreeper)" },
    ]);
  });

  it("keeps the first entry when neither has an icon", () => {
    const { entries } = dedupeByName([makeEntry("Cosmetic_Pet_A", "pet", { name }), makeEntry("Cosmetic_Pet_B", "pet", { name })]);
    expect(entries.map((entry) => entry.id)).toEqual(["Cosmetic_Pet_A"]);
  });

  it("leaves non-cosmetic categories and upcoming entries alone", () => {
    const burning = loc({ zh: "燃燒", en: "Burning" });
    const input = [
      makeEntry("Burning", "status", { name: burning }),
      makeEntry("Burning_Infinite", "status", { name: burning }),
      makeEntry("Cosmetic_Cape_X", "cape", { name, release: "upcoming" }),
      makeEntry("Cosmetic_Cape_Y", "cape", { name, release: "upcoming" }),
    ];
    expect(dedupeByName(input)).toEqual({ entries: input, issues: [] });
  });
});
