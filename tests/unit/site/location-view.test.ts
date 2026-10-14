import { describe, expect, it } from "vitest";
import type { Location, LocationData } from "../../../scripts/extract/location-schema";
import type { Mob } from "../../../scripts/extract/mob-schema";
import { formatLevels, locationCounts, locationOfArea, lootKeys, sharesRegionName } from "../../../src/lib/location-view";
import { loc } from "../../helpers/localized";

const location = (slug: string, partial: Partial<Location> = {}): Location => ({
  slug, areaId: `SW.Area.${slug}`, name: loc({ en: slug }), untranslated: [], levels: [], subLocations: [], mobs: [], quests: [], lootSources: [], ...partial,
});
const mob = (slug: string, kind: Mob["kind"]): Mob => ({ slug, id: slug, kind, world: null, name: loc({ en: slug }), untranslated: [], stats: [], variants: [], areas: [], drops: [] });
const MOBS = new Map([["maw", mob("maw", "boss")], ["warden", mob("warden", "miniboss")], ["zombie", mob("zombie", "regular")]]);

describe("locationCounts", () => {
  it("counts published mobs, bosses only (not mini-bosses) and quests", () => {
    const counts = locationCounts(location("deep", { mobs: ["maw", "warden", "zombie", "ghost"], quests: ["ca03", "ca06"] }), (slug) => MOBS.get(slug));
    expect(counts).toEqual({ mobs: 3, bosses: 1, quests: 2 });
  });
});

describe("formatLevels", () => {
  it("joins the levels and is empty without any", () => {
    expect(formatLevels([14, 45])).toBe("14 / 45");
    expect(formatLevels([6])).toBe("6");
    expect(formatLevels([])).toBe("");
  });
});

describe("sharesRegionName", () => {
  it("compares the English names", () => {
    const sift = location("sift", { name: loc({ en: "The Sift", zh: "篩境" }) });
    expect(sharesRegionName({ name: loc({ en: "The Sift" }), untranslated: [], areaIds: ["a"] }, sift)).toBe(true);
    expect(sharesRegionName({ name: loc({ en: "Rift" }), untranslated: [], areaIds: ["a"] }, sift)).toBe(false);
  });
});

describe("locationOfArea", () => {
  const data: LocationData = { locations: [location("woods"), location("deep")], areas: { "SW.Area.Forest.A1": "woods", "SW.Area.Gone": "missing" } };
  it("finds the location an area id belongs to", () => {
    expect(locationOfArea(data, "SW.Area.Forest.A1")?.slug).toBe("woods");
  });
  it("gives nothing for an unknown id, an inherited property or a slug with no location", () => {
    expect(locationOfArea(data, "SW.Area.Nowhere")).toBeUndefined();
    expect(locationOfArea(data, "toString")).toBeUndefined();
    expect(locationOfArea(data, "SW.Area.Gone")).toBeUndefined();
  });
});

describe("lootKeys", () => {
  it("lists the items of the location's area pools in source order", () => {
    const items = {
      "melee/axe": { areas: ["area:SW.Area.Forest.A1"] },
      "armor/hood": { areas: ["area:SW.Area.Plains.A1"] },
      "ranged/bow": { areas: ["area:SW.Area.Plains.A1", "area:SW.Area.Forest.A1"] },
    };
    expect(lootKeys(location("woods", { lootSources: ["area:SW.Area.Forest.A1"] }), items)).toEqual(["melee/axe", "ranged/bow"]);
    expect(lootKeys(location("crags"), items)).toEqual([]);
  });
});
