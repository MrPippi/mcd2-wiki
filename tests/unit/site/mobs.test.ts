import { describe, expect, it } from "vitest";
import type { Mob, MobArea } from "../../../scripts/extract/mob-schema";
import {
  dropPoolNote,
  dropSummary,
  splitNumbers,
  findMob,
  formatChance,
  formatStat,
  mapLinkOf,
  mobData,
  mobDescription,
  mobGroups,
  uniqueAreas,
} from "../../../src/lib/mobs";
import { loc } from "../../helpers/localized";

const mob = (slug: string, kind: Mob["kind"], en: string): Mob => ({ slug, id: slug, kind, world: null, name: loc({ en }), untranslated: [], stats: [], variants: [], areas: [], drops: [] });

describe("mobGroups", () => {
  it("orders bosses, mini-bosses, regular mobs and variants, sorts by English name, and skips empty groups", () => {
    const groups = mobGroups([mob("zombie", "regular", "Zombie"), mob("husk", "variant", "Husk"), mob("maw", "boss", "Twisted Warden"), mob("bee", "regular", "Bee")]);
    expect(groups.map((group) => [group.kind, group.mobs.map((m) => m.slug)])).toEqual([["boss", ["maw"]], ["regular", ["bee", "zombie"]], ["variant", ["husk"]]]);
  });

  it("does not reorder the list it is given", () => {
    const list = [mob("zombie", "regular", "Zombie"), mob("bee", "regular", "Bee")];
    mobGroups(list);
    expect(list.map((m) => m.slug)).toEqual(["zombie", "bee"]);
  });
});

describe("formatting", () => {
  it("prints multipliers with a times sign and plain numbers without trailing zeros", () => {
    expect(formatStat("health", 8)).toBe("8");
    expect(formatStat("movementSpeed", 300)).toBe("300");
    expect(formatStat("resistBlast", 1.5)).toBe("×1.5");
    expect(formatStat("meleeAttackSpeed", 1.25)).toBe("×1.25");
    expect(formatStat("knockbackResistance", 0)).toBe("×0");
    expect(formatStat("mass", 0.333333)).toBe("0.33");
  });

  it("prints a chance as a percentage in the page language", () => {
    expect(formatChance(0.0125, "en")).toBe("1.25%");
    expect(formatChance(0.5, "en")).toBe("50%");
    expect(formatChance(0.25, "de")).toMatch(/^25\s?%$/);
  });

  it("describes a boss drop as one guaranteed plus rolls, and omits the part that is zero", () => {
    const boss = { slot: "item", guaranteed: 1, rolls: 6, chancePerRoll: 0.5, pool: "area" } as const;
    expect(dropSummary(boss, "en")).toEqual(["Guaranteed: 1", "Random rolls: 6, 50% each"]);
    expect(dropSummary({ ...boss, guaranteed: 0, rolls: 1, chancePerRoll: 0.0125 }, "zh")).toEqual(["隨機次數：1，每次 1.25%"]);
  });

  it("describes a slot with no rolls as guaranteed only", () => {
    expect(dropSummary({ slot: "talismans", guaranteed: 1, rolls: 0, chancePerRoll: 0, pool: "own" }, "en")).toEqual(["Guaranteed: 1"]);
  });
});

describe("dropPoolNote", () => {
  it("says where gear comes from, and that the odds use the area pool when the data names no list", () => {
    const item = { slot: "item", guaranteed: 0, rolls: 1, chancePerRoll: 0.0125 } as const;
    expect(dropPoolNote({ ...item, pool: "area" }, "en")).toBe("Items come from the area's drop pool.");
    expect(dropPoolNote({ ...item, pool: "own" }, "en")).toBe("Items come from this mob's own list.");
    expect(dropPoolNote({ ...item, pool: "none" }, "en")).toBe("The data names no item list for this mob; the drop odds use the pool of the area it is in.");
  });

  it("adds nothing to slots whose label already says what drops", () => {
    expect(dropPoolNote({ slot: "emeralds", guaranteed: 0, rolls: 5, chancePerRoll: 0.025, pool: "own" }, "en")).toBeUndefined();
  });
});

describe("mapLinkOf", () => {
  it("links to the area's position on its world map, or to the map page when the area has no marker", () => {
    const area = { areaId: "SW.Area.Desert.A1", name: loc({ en: "Frozen Highlands" }) };
    expect(mapLinkOf("zh", { ...area, map: { world: "overworld", px: 6611.2, py: 4173.1 } })).toBe("/zh/map/?world=overworld#4/6611/4173");
    expect(mapLinkOf("zh", area)).toBe("/zh/map/");
  });
});

describe("uniqueAreas", () => {
  const area = (areaId: string, en: string, zh: string, map?: MobArea["map"]): MobArea => ({ areaId, name: loc({ en, zh }), map });

  it("keeps one area per name shown in the page language, preferring one with a map marker", () => {
    const areas = [
      area("SW.Area.DeepDark.Boss", "Dungeon", "地下城"),
      area("SW.Area.DeepDark.T1", "Dungeon", "地下城", { world: "overworld", px: 1, py: 2 }),
      area("SW.Area.Forest.A1", "Howling Woods", "嚎叫森林", { world: "overworld", px: 3, py: 4 }),
      area("SW.Area.DeepDark.T2", "Dungeon", "地下城", { world: "overworld", px: 5, py: 6 }),
    ];
    expect(uniqueAreas(areas, "zh").map((a) => a.areaId)).toEqual(["SW.Area.DeepDark.T1", "SW.Area.Forest.A1"]);
  });

  it("keeps the first of the same-named areas when none has a marker", () => {
    const areas = [area("A", "Dungeon", "地下城"), area("B", "Dungeon", "地下城")];
    expect(uniqueAreas(areas, "en").map((a) => a.areaId)).toEqual(["A"]);
  });

  it("dedupes by the page language name only", () => {
    const areas = [area("A", "Dungeon", "地下城"), area("B", "Dungeon", "深淵")];
    expect(uniqueAreas(areas, "zh").map((a) => a.areaId)).toEqual(["A", "B"]);
    expect(uniqueAreas(areas, "en").map((a) => a.areaId)).toEqual(["A"]);
  });
});

describe("mob data", () => {
  it("is valid and has unique slugs", () => {
    const slugs = mobData.mobs.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(findMob("zombie")?.name.en).toBe("Zombie");
    expect(findMob("zombie")?.stats[0]).toEqual({ key: "health", value: 8 });
    expect(findMob("no-such-mob")).toBeUndefined();
  });
});

describe("mobDescription", () => {
  it("names the mob, its kind, the bestiary and the game in the page language", () => {
    const maw = mob("maw", "boss", "Twisted Warden");
    expect(mobDescription(maw, "en")).toBe("Twisted Warden · Boss · Bestiary · Minecraft Dungeons II");
    expect(mobDescription({ ...maw, name: loc({ en: "Twisted Warden", zh: "扭曲監守者" }) }, "zh")).toBe("扭曲監守者 · 頭目 · 怪物圖鑑 · Minecraft Dungeons II");
  });
});

describe("splitNumbers", () => {
  it("separates counts and percentages from the words around them", () => {
    expect(splitNumbers("Random rolls: 6, 12.5% each")).toEqual(["Random rolls: ", "6", ", ", "12.5%", " each"]);
    expect(splitNumbers("隨機次數：1，每次 1.25%")).toEqual(["隨機次數：", "1", "，每次 ", "1.25%", ""]);
  });
});
