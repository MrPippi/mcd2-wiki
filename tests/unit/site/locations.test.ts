import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LocationDataSchema } from "../../../scripts/extract/location-schema";
import rawLocations from "../../../src/data/locations.json";
import rawSources from "../../../src/data/loot-sources.json";
import {
  bossList,
  countsOf,
  findLocation,
  locationData,
  locationDescription,
  locationHref,
  locationLoot,
  locationMobGroups,
  locationOf,
  locationQuests,
} from "../../../src/lib/locations";
import { findMob, mobData } from "../../../src/lib/mobs";
import { findQuest, questData } from "../../../src/lib/quests";
import { SITE_MENU } from "../../../src/lib/site-menu";

const location = (slug: string) => {
  const found = findLocation(slug);
  if (!found) throw new Error(`no location ${slug}`);
  return found;
};

describe("locations.json", () => {
  it("validates against the schema", () => {
    expect(LocationDataSchema.safeParse(rawLocations).success).toBe(true);
  });

  it("has one location per destination region, in story order", () => {
    expect(locationData.locations.map((one) => one.slug)).toEqual([
      "brave-haven", "squid-coast", "honeycomb-fields", "howling-woods", "the-deep-dark", "rainy-plains", "frozen-highlands",
      "singers-meadow", "humbler-huskland", "lullaby-hills", "the-sift", "ravines", "lush-caves", "deadleaf-forest", "cinder-crags",
    ]);
  });

  it("takes levels only from the progression table", () => {
    expect(location("howling-woods").levels).toEqual([6]);
    expect(location("the-deep-dark").levels).toEqual([14, 45]);
    for (const slug of ["squid-coast", "the-sift", "ravines", "lush-caves", "deadleaf-forest", "cinder-crags"]) expect(location(slug).levels, slug).toEqual([]);
  });

  it("publishes only the game's area icons, and only files that exist", () => {
    expect(location("the-deep-dark").icon).toBeUndefined();
    expect(location("ravines").icon).toBeUndefined();
    for (const one of locationData.locations) {
      if (one.icon) expect(existsSync(path.join("public", one.icon)), one.icon).toBe(true);
    }
  });

  it("folds procedural repeats into one place line that keeps every tag", () => {
    const dungeon = location("the-deep-dark").subLocations.find((place) => place.name.en === "Dungeon");
    expect(dungeon?.areaIds.length).toBe(23);
    expect(location("the-sift").subLocations.map((place) => [place.name.en, place.areaIds.length])).toEqual([["The Sift", 24]]);
    const spider = location("howling-woods").subLocations.find((place) => place.name.en === "Spider Caves");
    expect(spider?.areaIds.length).toBe(4);
    expect(spider?.name.sv).toContain(" / ");   // the game names two of the rows differently in Swedish
  });

  it("links only to mobs, quests and loot sources that exist", () => {
    for (const one of locationData.locations) {
      for (const slug of one.mobs) expect(findMob(slug), `${one.slug} mob ${slug}`).toBeDefined();
      for (const slug of one.quests) expect(findQuest(slug), `${one.slug} quest ${slug}`).toBeDefined();
      for (const id of one.lootSources) expect(Object.hasOwn(rawSources.sources, id), `${one.slug} ${id}`).toBe(true);
    }
  });

  it("gives every mob area and every quest region a location", () => {
    for (const mob of mobData.mobs) for (const area of mob.areas) expect(locationOf(area.areaId), `${mob.slug} ${area.areaId}`).toBeDefined();
    for (const quest of questData.quests) if (quest.region) expect(locationOf(quest.region.areaId), quest.slug).toBeDefined();
  });
});

describe("location lookups", () => {
  it("counts mobs, bosses and quests for the card", () => {
    expect(countsOf(location("the-deep-dark"))).toEqual({ mobs: 13, bosses: 4, quests: 1 });
  });

  it("groups a location's mobs by kind and lists its quests and loot", () => {
    expect(locationMobGroups(location("frozen-highlands")).map((group) => group.kind)).toEqual(["boss", "miniboss", "regular", "variant"]);
    expect(locationQuests(location("howling-woods")).map((quest) => quest.slug)).toContain("ca03");
    expect(locationLoot(location("cinder-crags")).length).toBeGreaterThan(0);
    expect(locationLoot(location("lush-caves"))).toEqual([]);
  });

  it("links and describes a location", () => {
    expect(locationHref("zh", "ravines")).toBe("/zh/locations/ravines/");
    expect(locationDescription(location("howling-woods"), "en")).toBe("Howling Woods · Locations · Minecraft Dungeons II");
  });

  it("puts locations and bosses in the menu after the quests", () => {
    expect(SITE_MENU.slice(-3).map((item) => item.segment)).toEqual(["quests", "locations", "bosses"]);
  });
});

describe("bossList", () => {
  const groups = bossList();
  it("lists the 10 bosses in story order, then the 6 mini-bosses", () => {
    expect(groups.map((group) => [group.kind, group.bosses.length])).toEqual([["boss", 10], ["miniboss", 6]]);
    expect(groups[0]?.bosses.map((boss) => boss.mob.slug)).toEqual([
      "soul-corrupted-witch", "maw", "monstrosity-copper", "frostbite-desert-boss", "monstrosity-sculk", "shade",
      "soul-construct", "monstrosity-red-stone", "supreme-evoker", "monstrosity-moss",
    ]);
  });

  it("places the Soul Corrupted Witch through CA02_B and its replay", () => {
    const witch = groups[0]?.bosses[0];
    expect(witch?.coreQuests.map((quest) => quest.slug)).toEqual(["ca02-b"]);
    expect(witch?.replayQuests.map((quest) => quest.slug)).toEqual(["ca02-b-br"]);
  });

  it("names each boss's core quest and replay", () => {
    const copper = groups[0]?.bosses.find((boss) => boss.mob.slug === "monstrosity-copper");
    expect(copper?.coreQuests.map((quest) => quest.slug)).toEqual(["ca07"]);
    expect(copper?.replayQuests.map((quest) => quest.slug)).toEqual(["ca07-br"]);
  });
});
