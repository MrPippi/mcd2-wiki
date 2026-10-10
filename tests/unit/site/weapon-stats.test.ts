import { describe, expect, it } from "vitest";
import { findEntry } from "../../../src/lib/data";
import { weaponStatsView } from "../../../src/lib/weapon-stats";

const view = (lang: "zh" | "en", category: "melee" | "ranged", slug: string) => {
  const weapon = findEntry(category, slug);
  return weapon ? weaponStatsView(lang, weapon) : undefined;
};
const value = (rows: readonly { label: string; value: string }[] | undefined, label: string) =>
  rows?.find((row) => row.label === label)?.value;

describe("weaponStatsView for a melee weapon", () => {
  const axe = view("zh", "melee", "axe");

  it("sums the combo and reports its length, top hit and reach", () => {
    expect(value(axe?.tiles, "整套連擊")).toBe("52");
    expect(value(axe?.tiles, "連擊段數")).toBe("3");
    expect(value(axe?.tiles, "最高單擊")).toBe("22");
    expect(value(axe?.tiles, "攻擊距離")).toBe("3.5 格");
  });

  it("lists each swing and the jump attack, with the unit in the column head", () => {
    expect(axe?.combo?.columns).toEqual(["招式", "傷害", "命中", "硬直", "距離（格）", "擊退"]);
    expect(axe?.combo?.rows[0]).toEqual(["第 1 擊", "14", "1", "27.5", "2.5", "500"]);
    expect(axe?.combo?.rows.at(-1)?.[0]).toBe("跳躍攻擊");
  });

  it("names archetypes and weight in the page's language", () => {
    expect(value(axe?.facts, "定位")).toBe("遊俠、召喚師");
    expect(value(view("en", "melee", "axe")?.facts, "Archetype")).toBe("Ranger + Summoner");
    expect(value(axe?.facts, "重量")).toBe("中型");
  });
});

describe("weaponStatsView for a ranged weapon", () => {
  it("reports shot damage, charged shots, fire rate, ammo and range, and no combo", () => {
    const bow = view("zh", "ranged", "bow");
    expect(value(bow?.tiles, "每發傷害")).toBe("18");
    expect(value(bow?.tiles, "蓄力射擊")).toBe("54");
    expect(value(bow?.tiles, "每秒射擊數")).toBe("2.5");
    expect(value(bow?.tiles, "彈藥")).toBe("15");
    expect(value(bow?.tiles, "射程")).toBe("7.5 格");
    expect(value(bow?.facts, "蓄力時間")).toBe("0.35 秒");
    expect(value(bow?.facts, "跳躍射擊")).toBeUndefined();
    expect(bow?.combo).toBeUndefined();
  });

  it("shows several projectiles per shot and a jump-shot penalty when the weapon has them", () => {
    expect(value(view("zh", "ranged", "scatter-crossbow")?.tiles, "每發傷害")).toMatch(/×3$/);
    expect(value(view("zh", "ranged", "greatbow")?.facts, "跳躍射擊")).toBe("×0.75");
  });

  it("leaves out charged shots on weapons that cannot charge", () => {
    const harp = view("zh", "ranged", "scatter-crossbow-unique1");
    expect(value(harp?.tiles, "蓄力射擊")).toBeUndefined();
    expect(value(harp?.facts, "蓄力時間")).toBeUndefined();
  });

  it("is undefined for anything that is not a weapon", () => {
    const effect = findEntry("effect", "critical-edge");
    expect(effect ? weaponStatsView("zh", effect) : "missing").toBeUndefined();
  });
});
