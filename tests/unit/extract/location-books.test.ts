import { describe, expect, it } from "vitest";
import { addLocationBooks } from "../../../scripts/extract/location-books";
import type { Location, LocationData } from "../../../scripts/extract/location-schema";
import type { ItemSourcesData } from "../../../scripts/extract/mob-schema";
import { localizedFrom } from "../../../src/lib/lang";
import { lootRow, lootTables } from "../../helpers/mob-tables";

const place = (slug: string, areaId: string, lootSources: string[], areaIds: string[] = []): Location => ({
  slug, areaId, name: localizedFrom(() => slug), untranslated: [], levels: [], mobs: [], quests: [], lootSources,
  subLocations: areaIds.length > 0 ? [{ name: localizedFrom(() => "Dungeon"), untranslated: [], areaIds }] : [],
});

const DATA: LocationData = {
  locations: [
    place("deep", "SW.Area.DeepDark.A1", ["area:SW.Area.DeepDark.A1"], ["SW.Area.DeepDark.Dungeons.1"]),
    place("plains", "SW.Area.Plains.A1", ["area:SW.Area.Plains.A1"]),
    place("sift", "SW.Area.Meadow.T1", []),
    place("lush", "SW.Area.Lush.Boss", []),
  ],
  areas: { "SW.Area.DeepDark.A1": "deep", "SW.Area.Plains.A1": "plains" },
};

const pool = (name: string) => ({ kind: "bookPool" as const, name: localizedFrom(() => name), untranslated: [] });
const book = (...bookPools: string[]) => ({ areas: [], chests: [], quests: [], merchants: [], bookPools });
const SOURCES: ItemSourcesData = {
  sources: { "bookPool:EnchantmentBooksCommon": pool("All areas"), "bookPool:EnchantmentBooksDeepDark": pool("Dungeon"), "bookPool:EnchantmentBooksMeadow": pool("The Sift") },
  items: {
    "enchantment-book/common-a": book("bookPool:EnchantmentBooksCommon"),
    "enchantment-book/dark-a": book("bookPool:EnchantmentBooksDeepDark"),
    "enchantment-book/meadow-a": book("bookPool:EnchantmentBooksMeadow"),
    "armor/plain": { ...book(), areas: ["area:SW.Area.Plains.A1"] },
  },
  bookDrops: [{ id: "chest:FancyChest", guaranteed: 1, rolls: 1, chancePerRoll: 0.5 }, { id: "mob:PiggyBank", guaranteed: 0, rolls: 1, chancePerRoll: 0.5 }],
};

const area = (name: string, typeTag: string, traits: string[] = []) => lootRow(name, typeTag, [], traits);
const LOOT = lootTables({
  generic: [lootRow("EnchantmentBooksCommon", "SW.LootSource.EnchantmentBooks.Common", []), lootRow("EnchantmentBooksDeepDark", "SW.LootSource.EnchantmentBooks.DeepDark", []), lootRow("EnchantmentBooksMeadow", "SW.LootSource.EnchantmentBooks.Meadow", [])],
  area: [
    area("GlobalAreaLoot", "SW.Area", ["SW.LootSource.EnchantmentBooks.Common"]),
    area("DeepDarkDungeons", "SW.Area.DeepDark.Dungeons", ["SW.LootSource.EnchantmentBooks.DeepDark"]),
    area("WellspringT1", "SW.Area.Meadow.T1", ["SW.LootSource.EnchantmentBooks.Meadow"]),
  ],
  lootActor: [lootRow("FancyChest", "SW.Loot.FancyChest", [])],
});

const run = (placements: Record<string, string[]>) =>
  Object.fromEntries(addLocationBooks({ data: DATA, sources: SOURCES, loot: LOOT, placements: new Map(Object.entries(placements)) }).locations.map((one) => [one.slug, one.books]));

describe("addLocationBooks", () => {
  it("marks the books certain where a book chest is placed, through a sub-location area or the region's own area", () => {
    const books = run({ "sw.loot.fancychest": ["SW.Area.DeepDark.Dungeons.1", "SW.Area.Test.Gym"] });
    expect(books.deep).toEqual({ certain: ["enchantment-book/common-a", "enchantment-book/dark-a"], inferred: [] });
    expect(books.plains).toEqual({ certain: [], inferred: ["enchantment-book/common-a"] });
  });

  it("gives the global pool only to regions with an area drop pool or a pool of their own", () => {
    const books = run({});
    expect(books.sift).toEqual({ certain: [], inferred: ["enchantment-book/common-a", "enchantment-book/meadow-a"] });
    expect(books.lush).toBeUndefined();
    expect(books.deep?.inferred).toEqual(["enchantment-book/common-a", "enchantment-book/dark-a"]);
  });

  it("does not place a chest by a sibling area name or by a mob dropper", () => {
    expect(run({ "sw.loot.fancychest": ["SW.Area.DeepDark.A12"] }).deep?.certain).toEqual([]);
  });

  it("leaves the input untouched", () => {
    run({});
    expect(DATA.locations.every((one) => one.books === undefined)).toBe(true);
  });
});
