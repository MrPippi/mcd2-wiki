import { describe, expect, it } from "vitest";
import { LANGS } from "../../../scripts/extract/config";
import type { Weapon } from "../../../scripts/extract/weapon-schema";
import { comparePayload, comparePayloadJson, compareWeapons } from "../../../src/lib/compare/payload";
import { parseComparePayload } from "../../../src/lib/compare/parse";
import { compareCells, compareRows, COMPARE_KEYS } from "../../../src/lib/compare/rows";

const swing = (damage: number, hits = 1, stagger = 1, reach = 2, knockback = 0) => ({ damage, hits, stagger, reach, knockback });
const MELEE: Weapon = {
  archetypes: ["Fighter", "Tank"],
  weight: "Heavy",
  melee: { swings: [swing(10, 1, 2, 2.5, 1), swing(20, 2, 5, 3, 3)] },
  compatible: [],
};
const RANGED: Weapon = {
  archetypes: [],
  ranged: { damage: 10, projectiles: 3, chargedMultiplier: 2, attackRateSeconds: 0.5, ammo: 15, range: 3000, chargeSeconds: 0, rechargeSeconds: 4, jumpShotMultiplier: 1, stagger: 1, knockback: 2 },
  compatible: [],
};

describe("compareRows", () => {
  it("has a label and a ranking for every key", () => {
    const rows = compareRows("en");
    expect(rows.map((row) => row.key)).toEqual([...COMPARE_KEYS]);
    expect(rows.find((row) => row.key === "charge")?.better).toBe("low");
    expect(rows.find((row) => row.key === "fullCombo")?.better).toBe("high");
    expect(rows.find((row) => row.key === "weight")?.better).toBe("none");
  });
});

describe("compareCells", () => {
  it("sums the combo and takes the best swing for melee", () => {
    const cells = compareCells("en", MELEE);
    expect(cells.fullCombo).toEqual({ text: "50", value: 50 });
    expect(cells.topHit?.value).toBe(20);
    expect(cells.stagger?.value).toBe(5);
    expect(cells.reach?.value).toBe(3);
    expect(cells.swings).toEqual({ text: "2" });
    expect(cells.archetypes?.text).toContain("Fighter");
    expect(cells.shotDamage).toBeUndefined();
  });

  it("counts every projectile and leaves charge rows out of a weapon that cannot charge", () => {
    const cells = compareCells("en", RANGED);
    expect(cells.shotDamage).toEqual({ text: "10 ×3", value: 30 });
    expect(cells.shotsPerSecond?.value).toBe(2);
    expect(cells.chargedShot).toBeUndefined();
    expect(cells.charge).toBeUndefined();
    expect(cells.archetypes).toBeUndefined();
    expect(cells.fullCombo).toBeUndefined();
  });
});

describe("charging ranged weapons", () => {
  const CHARGING: Weapon = { ...RANGED, ranged: { ...RANGED.ranged!, projectiles: 2, chargeSeconds: 1.5, chargedMultiplier: 3 } };

  it("shows the charged shot like the plain shot and ranks the charge time", () => {
    const cells = compareCells("en", CHARGING);
    expect(cells.shotDamage).toEqual({ text: "10 ×2", value: 20 });
    expect(cells.chargedShot).toEqual({ text: "30 ×2", value: 60 });
    expect(cells.charge?.value).toBe(1.5);
  });
});

describe("comparePayload", () => {
  it("passes its own check in every language", () => {
    for (const lang of LANGS) expect(parseComparePayload(JSON.parse(comparePayloadJson(comparePayload(lang)))), lang).toBeDefined();
  });

  it("lists every released weapon with its effects", () => {
    const weapons = compareWeapons("en");
    expect(weapons.filter((weapon) => weapon.kind === "melee").length).toBeGreaterThan(40);
    expect(weapons.filter((weapon) => weapon.kind === "ranged").length).toBeGreaterThan(15);
    expect(weapons.every((weapon) => weapon.effects.length > 0)).toBe(true);
    expect(weapons.some((weapon) => weapon.fixed)).toBe(true);
  });

  it("stays small enough to inline", () => {
    for (const lang of LANGS) expect(comparePayloadJson(comparePayload(lang)).length, lang).toBeLessThan(120_000);
  });

  it.each([
    ["not an object", () => null],
    ["a bad ranking", () => ({ ...comparePayload("en"), rows: [{ key: "x", label: "X", better: "up" }] })],
    ["a weapon of another kind", () => ({ ...comparePayload("en"), weapons: [{ ...comparePayload("en").weapons[0], kind: "talisman" }] })],
    ["a cell value that is not a number", () => ({ ...comparePayload("en"), weapons: [{ ...comparePayload("en").weapons[0], cells: { ammo: { text: "1", value: "1" } } }] })],
    ["a column label without {n}", () => ({ ...comparePayload("en"), labels: { ...comparePayload("en").labels, column: "Weapon" } })],
  ])("rejects %s", (_name, make) => {
    expect(parseComparePayload(make())).toBeUndefined();
  });
});
