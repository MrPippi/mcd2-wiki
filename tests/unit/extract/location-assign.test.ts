import { describe, expect, it } from "vitest";
import { assignRows, covers, foldSubLocations, ownerOf, rowName } from "../../../scripts/extract/location-assign";
import type { RegionList } from "../../../shared/location-schema";
import { makeSparseLocales, ns } from "../../helpers/locales";
import { locationRow } from "../../helpers/location-tables";

const LIST: RegionList = {
  regions: [
    { slug: "deep-dark", areas: ["SW.Area.DeepDark.A1", "SW.Area.DeepDark.A2"], members: ["SW.Area.DeepDark"] },
    { slug: "lush", areas: ["SW.Area.Lush.Boss"] },
    { slug: "plains", areas: ["SW.Area.Plains.A1"] },
  ],
  excluded: { "SW.Area": "default row", "SW.Area.Test.*": "test levels", "SW.Area.Plains.A1.Link": "link zone" },
};

const AREAS = ns("DT_AreaDefinition");
const LOCALES = makeSparseLocales({
  [AREAS]: {
    Dungeon: { en: "Dungeon", zh: "地下城", sv: "Grotta" },
    Dungeon2: { en: "Dungeon", zh: "地下城", sv: "Grottan" },
    Hut: { en: "Witch's Hut" },
    Broken: { en: "ERROR" },
  },
});

describe("covers", () => {
  it("matches the tag itself and whole segments below it, in any case", () => {
    expect(covers("SW.Area.DeepDark", "SW.Area.DeepDark")).toBe(true);
    expect(covers("SW.Area.DeepDark", "Sw.Area.deepdark.Boss.1")).toBe(true);
    expect(covers("SW.Area.Deep", "SW.Area.DeepDark")).toBe(false);
  });
});

describe("ownerOf", () => {
  const slug = (tag: string) => {
    const owner = ownerOf(LIST, tag);
    return owner.kind === "region" ? owner.region.slug : owner.kind;
  };

  it("gives a tag to the region that lists it or a parent of it", () => {
    expect(slug("SW.Area.DeepDark.A1")).toBe("deep-dark");
    expect(slug("SW.Area.DeepDark.Dungeons.12")).toBe("deep-dark");
    expect(slug("SW.Area.Lush.Boss")).toBe("lush");
  });

  it("lets the longest listed tag win, an exclusion as much as a region", () => {
    expect(slug("SW.Area.Plains.A1.Link")).toBe("excluded");
    expect(slug("SW.Area.Plains.A1.Barn")).toBe("plains");
  });

  it("matches a plain exclusion exactly and a .* exclusion with everything below it", () => {
    expect(ownerOf(LIST, "SW.Area")).toEqual({ kind: "excluded", reason: "default row" });
    expect(ownerOf(LIST, "SW.Area.Test.Gym.A1")).toEqual({ kind: "excluded", reason: "test levels" });
    expect(ownerOf(LIST, "SW.Area.Test")).toEqual({ kind: "excluded", reason: "test levels" });
    expect(ownerOf(LIST, "SW.Area.Mines.Interior")).toEqual({ kind: "none" });
  });

  it("prefers the exclusion on a tie", () => {
    const tie: RegionList = { regions: [{ slug: "a", areas: ["SW.Area.X"] }], excluded: { "SW.Area.X": "left out" } };
    expect(ownerOf(tie, "SW.Area.X").kind).toBe("excluded");
  });
});

describe("rowName", () => {
  it("reads the name through the loc table and lists the languages that show English", () => {
    const name = rowName(locationRow("Hut", "SW.Area.Plains.A1.Hut"), LOCALES);
    expect(name?.text.zh).toBe("Witch's Hut");
    expect(name?.untranslated).toContain("zh");
    expect(name?.untranslated).not.toContain("en");
  });

  it("gives no name for a row without text, an unknown key or ERROR", () => {
    expect(rowName(locationRow("Nameless", "SW.Area.X", { key: null }), LOCALES)).toBeUndefined();
    expect(rowName(locationRow("Missing", "SW.Area.X"), LOCALES)).toBeUndefined();
    expect(rowName(locationRow("Broken", "SW.Area.X"), LOCALES)).toBeUndefined();
  });
});

describe("assignRows", () => {
  const rows = [
    locationRow("DeepDarkA1", "SW.Area.DeepDark.A1"),
    locationRow("Dungeon_1", "SW.Area.DeepDark.Dungeons.1"),
    locationRow("DeepDarkA2", "SW.Area.DeepDark.A2"),
    locationRow("Gym", "SW.Area.Test.Gym"),
    locationRow("Mines", "SW.Area.Mines.Interior.001"),
  ];
  const assigned = assignRows(LIST, rows);

  it("splits a region's own rows from its sub-location rows, in table order", () => {
    expect(assigned.byRegion.get("deep-dark")?.own.map((row) => row.Name)).toEqual(["DeepDarkA1", "DeepDarkA2"]);
    expect(assigned.byRegion.get("deep-dark")?.sub.map((row) => row.Name)).toEqual(["Dungeon_1"]);
    expect(assigned.byRegion.get("lush")).toEqual({ own: [], sub: [] });
  });

  it("reports every row left out and every row no entry covers", () => {
    expect(assigned.issues).toEqual([
      { type: "location-excluded", detail: "SW.Area.Test.Gym (Gym): test levels" },
      { type: "location-unassigned", detail: "SW.Area.Mines.Interior.001 (Mines)" },
    ]);
  });
});

describe("foldSubLocations", () => {
  const rows = [
    locationRow("D1", "SW.Area.DeepDark.Dungeons.1", { key: "Dungeon" }),
    locationRow("Hut", "SW.Area.DeepDark.Hut"),
    locationRow("D2", "SW.Area.DeepDark.Dungeons.2", { key: "Dungeon2" }),
    locationRow("D3", "SW.Area.DeepDark.Dungeons.3", { key: "Dungeon" }),
    locationRow("Nameless", "SW.Area.DeepDark.Nat", { key: null }),
  ];
  const folded = foldSubLocations("deep-dark", rows, LOCALES);

  it("folds rows with one English name into one line that keeps every tag, in first-seen order", () => {
    expect(folded.subLocations.map((line) => [line.name.en, line.areaIds])).toEqual([
      ["Dungeon", ["SW.Area.DeepDark.Dungeons.1", "SW.Area.DeepDark.Dungeons.2", "SW.Area.DeepDark.Dungeons.3"]],
      ["Witch's Hut", ["SW.Area.DeepDark.Hut"]],
    ]);
  });

  it("keeps each of a language's names when the folded rows differ in it", () => {
    const dungeon = folded.subLocations[0];
    expect(dungeon?.name.sv).toBe("Grotta / Grottan");
    expect(dungeon?.name.zh).toBe("地下城");
  });

  it("marks and reports English stand-ins and reports rows without a name", () => {
    expect(folded.subLocations[0]?.untranslated).toEqual(expect.arrayContaining(["ja", "de"]));
    expect(folded.subLocations[0]?.untranslated).not.toContain("zh");
    expect(folded.issues).toContainEqual({ type: "location-unnamed", detail: "deep-dark: SW.Area.DeepDark.Nat (Nameless)" });
    expect(folded.issues.filter((one) => one.type === "location-text-fallback").map((one) => one.detail.split(":")[1]?.trim())).toEqual(["Dungeon", "Witch's Hut"]);
  });
});
