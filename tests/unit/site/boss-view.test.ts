import { describe, expect, it } from "vitest";
import type { Location } from "../../../shared/location-schema";
import type { Mob } from "../../../shared/mob-schema";
import type { Quest } from "../../../shared/quest-schema";
import { bossGroups, healthOf } from "../../../src/lib/boss-view";
import { loc } from "../../helpers/localized";

const mob = (slug: string, kind: Mob["kind"], areas: string[] = [], name = slug): Mob => ({
  slug, id: slug, kind, world: null, name: loc({ en: name }), untranslated: [], stats: [{ key: "health", value: 100 }], variants: [],
  areas: areas.map((areaId) => ({ areaId, name: loc({ en: areaId }) })), drops: [],
});
const quest = (slug: string, section: Quest["section"], mobs: string[]): Quest => ({ slug, section, mobs }) as unknown as Quest;
const location = (slug: string, levels: number[]): Location => ({
  slug, areaId: slug, name: loc({ en: slug }), untranslated: [], levels, subLocations: [], mobs: [], quests: [], lootSources: [],
});

const LOCATIONS = new Map([["Forest", location("woods", [6])], ["Desert", location("highlands", [26])], ["Lush", location("lush", [])]]);
const locationOf = (areaId: string) => LOCATIONS.get(areaId);

// Core quests in chain order, then a side quest and replays.
const QUESTS = [
  quest("ca03", "core", ["maw", "warden"]),
  quest("ca07", "core", ["copper"]),
  quest("ca10", "core", ["construct", "redstone"]),
  quest("side", "side", ["moss"]),
  quest("ca03-br", "bossReplay", ["maw"]),
  quest("ca10-br", "bossReplay", ["construct", "redstone"]),
];

const MOBS = [
  mob("witch-t3", "boss", [], "Soul Corrupted Witch"),
  mob("moss", "boss", ["Lush"], "Mosstrosity"),
  mob("redstone", "boss", ["Desert"]),
  mob("frost", "boss", ["Desert", "Forest"]),
  mob("construct", "boss", ["Desert"]),
  mob("copper", "boss", ["Forest"]),
  mob("maw", "boss", ["Forest", "Nowhere", "Forest"]),
  mob("enderman", "miniboss", ["Forest"]),
  mob("warden", "miniboss", ["Desert"]),
  mob("zombie", "regular", ["Forest"]),
];

const groups = bossGroups(MOBS, QUESTS, locationOf);

describe("bossGroups", () => {
  it("lists bosses, then mini-bosses, and no other kind", () => {
    expect(groups.map((group) => group.kind)).toEqual(["boss", "miniboss"]);
  });

  it("orders by the core chain, then by the quest's mob order, then by the lowest region level, then by name", () => {
    expect(groups[0]?.bosses.map((boss) => boss.mob.slug)).toEqual(["maw", "copper", "construct", "redstone", "frost", "moss", "witch-t3"]);
  });

  it("keys a boss without a core quest on the lowest level among its regions, not its first area", () => {
    // "late" lists the level-26 region first but also lies in the level-6 one, so it sorts before "mid" (level 20).
    const extra = [location("plains", [20])];
    const lookup = (areaId: string) => (areaId === "Plains" ? extra[0] : locationOf(areaId));
    const ordered = bossGroups([mob("late", "boss", ["Desert", "Forest"]), mob("mid", "boss", ["Plains"])], [], lookup);
    expect(ordered[0]?.bosses.map((boss) => boss.mob.slug)).toEqual(["late", "mid"]);
    expect(groups[1]?.bosses.map((boss) => boss.mob.slug)).toEqual(["warden", "enderman"]);
  });

  it("names the core quests and replays that feature a boss", () => {
    const maw = groups[0]?.bosses[0];
    expect(maw?.coreQuests.map((one) => one.slug)).toEqual(["ca03"]);
    expect(maw?.replayQuests.map((one) => one.slug)).toEqual(["ca03-br"]);
    expect(groups[0]?.bosses.find((boss) => boss.mob.slug === "moss")?.coreQuests).toEqual([]);
  });

  it("gives each published location of its areas once, in area order", () => {
    expect(groups[0]?.bosses[0]?.locations.map((one) => one.slug)).toEqual(["woods"]);
    expect(groups[0]?.bosses.find((boss) => boss.mob.slug === "frost")?.locations.map((one) => one.slug)).toEqual(["highlands", "woods"]);
  });

  it("leaves out an empty group", () => {
    expect(bossGroups([mob("maw", "boss")], [], locationOf).map((group) => group.kind)).toEqual(["boss"]);
    expect(bossGroups([], QUESTS, locationOf)).toEqual([]);
  });
});

describe("healthOf", () => {
  it("reads the health stat", () => {
    expect(healthOf(mob("maw", "boss"))).toBe(100);
    expect(healthOf({ ...mob("maw", "boss"), stats: [] })).toBeUndefined();
  });
});
