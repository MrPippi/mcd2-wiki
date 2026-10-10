import { describe, expect, it } from "vitest";
import type { MapMarker } from "../../../scripts/extract/map-schema";
import type { Localized } from "../../../scripts/extract/schemas";
import { loc } from "../../helpers/localized";
import { countByKind, parseHiddenKinds, searchMarkers, serializeHiddenKinds, withKind } from "../../../src/lib/map/markers";

const marker = (id: string, kind: MapMarker["kind"], zh: string, en: string, area?: [string, string], extra: Partial<Localized> = {}): MapMarker => ({
  id,
  kind,
  px: 0,
  py: 0,
  name: loc({ zh, en, ...extra }),
  ...(area ? { area: loc({ zh: area[0], en: area[1] }) } : {}),
});

const MARKERS: readonly MapMarker[] = [
  marker("smith", "merchant", "鐵匠", "Blacksmith"),
  marker("rift1", "rift", "裂隙", "Rift", ["咆哮森林", "Howling Woods"]),
  marker("portal", "portal", "傳送雕像", "Teleport Statue", ["英雄港", "Brave Haven"]),
  marker("cart1", "minecart", "多雨平原", "Rainy Plains"),
];

describe("searchMarkers", () => {
  it("matches names in either language, ignoring case and surrounding spaces", () => {
    expect(searchMarkers(MARKERS, "鐵匠", "zh").map((m) => m.id)).toEqual(["smith"]);
    expect(searchMarkers(MARKERS, "  blackSMITH ", "zh").map((m) => m.id)).toEqual(["smith"]);
  });

  it("matches the area a marker sits in", () => {
    expect(searchMarkers(MARKERS, "  BRAVE haven ", "en").map((m) => m.id)).toEqual(["portal"]);
    expect(searchMarkers(MARKERS, "咆哮", "en").map((m) => m.id)).toEqual(["rift1"]);
  });

  it("searches the page language and its comparison language only, cased by the page language", () => {
    const istanbul = [marker("ist", "merchant", "君士坦丁堡", "Constantinople", undefined, { tr: "İSTANBUL", ja: "イスタンブール" })];
    expect(searchMarkers(istanbul, "istanbul", "tr").map((m) => m.id)).toEqual(["ist"]);
    expect(searchMarkers(istanbul, "İstanbul", "tr").map((m) => m.id)).toEqual(["ist"]);
    expect(searchMarkers(istanbul, "イスタンブール", "ja").map((m) => m.id)).toEqual(["ist"]);
    expect(searchMarkers(istanbul, "CONSTANTINOPLE", "ja").map((m) => m.id)).toEqual(["ist"]);
    expect(searchMarkers(istanbul, "イスタンブール", "de")).toEqual([]);
    expect(searchMarkers(istanbul, "君士坦丁堡", "ja")).toEqual([]);
  });

  it("returns nothing for an empty query and respects the limit", () => {
    expect(searchMarkers(MARKERS, "   ", "zh")).toEqual([]);
    expect(searchMarkers(MARKERS, "a", "en", 2)).toHaveLength(2);
  });

  it("leaves the input untouched", () => {
    const copy = structuredClone(MARKERS);
    searchMarkers(MARKERS, "rift", "en");
    expect(MARKERS).toEqual(copy);
  });
});

describe("countByKind", () => {
  it("counts every kind, including empty ones", () => {
    expect(countByKind(MARKERS)).toEqual({ minecart: 1, rift: 1, portal: 1, merchant: 1, area: 0 });
  });
});

describe("hidden kinds", () => {
  it("round-trips through storage in a fixed order", () => {
    const hidden = new Set(["rift", "minecart"] as const);
    expect(serializeHiddenKinds(hidden)).toBe('["minecart","rift"]');
    expect(parseHiddenKinds('["minecart","rift"]')).toEqual(new Set(["minecart", "rift"]));
  });

  it("treats missing or broken storage as nothing hidden", () => {
    expect(parseHiddenKinds(null)).toEqual(new Set());
    expect(parseHiddenKinds("{")).toEqual(new Set());
    expect(parseHiddenKinds('{"rift":true}')).toEqual(new Set());
  });

  it("drops unknown kinds", () => {
    expect(parseHiddenKinds('["bogus","rift",3]')).toEqual(new Set(["rift"]));
  });

  it("toggles a kind into a new set", () => {
    const hidden = new Set<MapMarker["kind"]>(["rift"]);
    const shown = withKind(hidden, "rift", true);
    expect(shown).toEqual(new Set());
    expect(hidden).toEqual(new Set(["rift"]));
    expect(withKind(shown, "area", false)).toEqual(new Set(["area"]));
  });
});
