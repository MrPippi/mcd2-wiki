import { describe, expect, it } from "vitest";
import {
  chestLabel, clockPayload, formatMultipliers, pickCount, rarityLine, scheduleOf, sharedMultipliers, soulStormData, spawnWeightText, summonedMobs, summonLine,
} from "../../../src/lib/soul-storm";
import { parseClockPayload, stormState } from "../../../src/lib/soul-storm-schedule";
import { SITE_MENU } from "../../../src/lib/site-menu";

describe("Soul Storm site data", () => {
  it("turns the extracted schedule into the real anchor and lengths", () => {
    expect(scheduleOf(soulStormData)).toEqual({ anchorMs: Date.UTC(2026, 0, 1), durationMs: 1_200_000, cadenceMs: 2_400_000, areaCount: 7, rotationOffset: 0 });
  });
  it("builds a payload the browser module accepts, in the page language", () => {
    const payload = clockPayload("zh");
    expect(parseClockPayload(JSON.parse(JSON.stringify(payload)))).toEqual(payload);
    expect(payload?.areas.map((area) => area.name)).toEqual(["咆哮森林", "吟唱者草甸", "多雨平原", "轟鳴蟲殼骸之地", "安眠丘陵", "冰封高地", "蜂巢原野"]);
    expect(payload?.areas[3].href).toMatch(/^\/zh\/map\/\?world=sift#4\//);
    expect(payload?.labels.now).toBe("進行中：{area}");
  });
  it("agrees with the browser module on a real instant", () => {
    const state = stormState(scheduleOf(soulStormData), Date.parse("2026-10-11T00:00:00Z"));
    expect(soulStormData.rotation[state.window.areaIndex].name.en).toBe("Humbler Huskland");
  });
  it("labels chests by group", () => {
    const [easy, , , low] = soulStormData.chests;
    expect(chestLabel(easy, "zh")).toBe("簡單");
    expect(chestLabel(low, "zh")).toBe("低");
  });
  it("formats the player multipliers and finds the summoned mobs", () => {
    expect(formatMultipliers([1, 1.5, 2, 2.5])).toBe("1 / 1.5 / 2 / 2.5");
    expect(summonedMobs(soulStormData.monstrosities).map((mob) => mob.slug)).toEqual(["monstrosity-copper", "monstrosity-red-stone", "monstrosity-sculk"]);
  });
  it("says how many mobs one final wave summons", () => {
    expect(pickCount({ minPick: 1, maxPick: 2 })).toBe("1–2");
    expect(pickCount({ minPick: 1, maxPick: 1 })).toBe("1");
    const [easy, medium] = soulStormData.generators;
    expect(summonLine(easy, "en")).toBe("At 20% health, summons 1–2 of");
    expect(summonLine(easy, "zh")).toBe("生命降到 20% 時，從以下召喚 1–2 隻");
    expect(summonLine(medium, "en")).toBe("At 40% health, summons 1 of");
  });
  it("shows a dash for a missing spawn weight and no multipliers when there are none", () => {
    expect(spawnWeightText(null)).toBe("—");
    expect(spawnWeightText(2)).toBe("2");
    const bare = soulStormData.generators.map((generator) => ({ ...generator, healthByPlayers: [] }));
    expect(sharedMultipliers(bare)).toBeUndefined();
  });
  it("writes the chest rarity numbers the way the page language does", () => {
    expect(rarityLine(soulStormData, "en")).toBe("Per the game data, storm chests weight rarities: Common ×0, Rare ×0.01");
    expect(rarityLine(soulStormData, "de")).toContain("×0,01");
    expect(rarityLine({ ...soulStormData, chestRarity: null }, "en")).toBeUndefined();
  });
  it("lists the page in the menu after the bestiary", () => {
    expect(SITE_MENU.map((item) => item.segment)).toEqual(["map", "achievements", "mobs", "soul-storm", "build", "compare", "quests", "locations", "bosses"]);
  });
});
