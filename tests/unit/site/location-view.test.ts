import { describe, expect, it } from "vitest";
import type { Location, LocationData } from "../../../shared/location-schema";
import type { Mob, MobDrop } from "../../../shared/mob-schema";
import type { Quest } from "../../../shared/quest-schema";
import type { Entry } from "../../../shared/schemas";
import { formatLevels, groupLoot, locationCounts, locationOfArea, lootKeys, mobSureItemKeys, questRewardKeys, sharesRegionName, type LootItem } from "../../../src/lib/location-view";
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

const entry = (category: string, slug: string) => ({ category, slug }) as Entry;
const loot = (category: string, slug: string, flags: Partial<LootItem> = {}): LootItem => ({ entry: entry(category, slug), unconfirmed: false, extra: false, ...flags });

describe("groupLoot", () => {
  it("groups by category in display order and leaves out empty groups and other categories", () => {
    const groups = groupLoot([loot("armor", "hood"), loot("enchantment-book", "fire"), loot("melee", "axe"), loot("armor", "boots"), loot("talisman", "llama"), loot("cape", "red")]);
    expect(groups.map((group) => [group.category, group.items.map((item) => item.entry.slug)])).toEqual([
      ["melee", ["axe"]], ["armor", ["hood", "boots"]], ["talisman", ["llama"]], ["enchantment-book", ["fire"]],
    ]);
  });

  it("lists an item once, and a confirmed listing wins over an unconfirmed one wherever it comes", () => {
    const groups = groupLoot([loot("enchantment-book", "fire", { unconfirmed: true }), loot("enchantment-book", "ice", { unconfirmed: true }), loot("enchantment-book", "fire")]);
    expect(groups[0]?.items.map((item) => [item.entry.slug, item.unconfirmed])).toEqual([["fire", false], ["ice", true]]);
  });

  it("is empty without items", () => {
    expect(groupLoot([])).toEqual([]);
  });
});

const drop = (partial: Partial<MobDrop>): MobDrop => ({ slot: "talismans", guaranteed: 1, rolls: 0, chancePerRoll: 0, pool: "own", items: ["talisman/llama"], ...partial });
const dropper = (slug: string, drops: MobDrop[]): Mob => ({ ...mob(slug, "boss"), drops });

describe("mobSureItemKeys", () => {
  it("takes the single item of a guaranteed own list with no rolls, once", () => {
    expect(mobSureItemKeys([dropper("a", [drop({})]), dropper("b", [drop({})])])).toEqual(["talisman/llama"]);
  });

  it("skips rolled, unguaranteed, shared-pool and multi-item lists", () => {
    const skipped = [drop({ rolls: 2 }), drop({ guaranteed: 0 }), drop({ pool: "area" }), drop({ items: ["a/b", "a/c"] }), drop({ items: undefined })];
    expect(mobSureItemKeys([dropper("a", skipped)])).toEqual([]);
  });
});

const quest = (rewards: Quest["rewards"]): Quest => ({ rewards }) as Quest;
const items = (...keys: string[]) => ({ kind: "items" as const, source: "quest:X", items: keys });

describe("questRewardKeys", () => {
  it("lists the item rewards of first and every completions once, skipping area drops", () => {
    const rewards = { first: [items("armor/a", "armor/b"), { kind: "areaDrop" as const, area: { name: loc({ en: "x" }) }, count: 1 }], every: [items("armor/b", "melee/c")], emeralds: null };
    expect(questRewardKeys([quest(rewards), quest({ first: [items("melee/c")], every: [], emeralds: null })])).toEqual(["armor/a", "armor/b", "melee/c"]);
  });
});
