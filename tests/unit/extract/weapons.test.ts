import { describe, expect, it } from "vitest";
import type { Entry } from "../../../scripts/extract/schemas";
import { buildWeaponData } from "../../../scripts/extract/weapons";
import { TABLES } from "../../helpers/datatables";

const entry = (category: Entry["category"], slug: string, id: string, variant: Entry["variant"] = "normal"): Entry => ({
  id,
  slug,
  category,
  variant,
  release: "base",
  name: { zh: id, en: id },
  links: {},
});

const ENTRIES: readonly Entry[] = [
  entry("melee", "axe", "Axe"),
  entry("melee", "axe-unique1", "Axe_Unique1", "unique"),
  entry("melee", "giant-club-unique1", "GiantClub_Unique1", "unique"),
  entry("ranged", "bow", "Bow"),
  entry("effect", "sharpness", "Sharpness"),
  entry("effect", "power", "Power"),
  entry("effect", "critical-edge", "CriticalEdge"),
  entry("effect", "looting", "Looting"),
  entry("effect", "reconstruction", "Reconstruction"),
  entry("effect", "status-on-hit-strength", "StatusOnHit_Strength"),
  entry("enchantment-book", "flame-belch-unique", "EnchantmentBook_FlameBelch_Unique", "unique"),
  entry("melee", "shovel-unique1", "Shovel_Unique1", "unique"),
  entry("enchantment", "shockwave", "Shockwave"),
];

describe("buildWeaponData", () => {
  const { data, issues } = buildWeaponData(ENTRIES, TABLES);

  it("reads archetypes and weight from the item's traits", () => {
    expect(data.weapons.axe).toMatchObject({ archetypes: ["Ranger"], weight: "Medium" });
    expect(data.weapons.bow).toMatchObject({ archetypes: [], weight: "Light" });
  });

  it("reads each melee swing and the jump attack, with distances in blocks", () => {
    expect(data.weapons.axe?.melee).toEqual({
      swings: [
        { damage: 14, hits: 1, stagger: 27.5, reach: 2.5, knockback: 500 },
        { damage: 22, hits: 1, stagger: 45, reach: 3.5, knockback: 700 },
      ],
      jump: { damage: 21, stagger: 42.5, reach: 2.5, knockback: 1250 },
    });
  });

  it("reads ranged shots through their projectile", () => {
    expect(data.weapons.bow?.ranged).toEqual({
      damage: 18,
      projectiles: 1,
      chargedMultiplier: 3,
      attackRateSeconds: 0.4,
      ammo: 15,
      range: 7.5,
      chargeSeconds: 0.35,
      rechargeSeconds: 1.2,
      jumpShotMultiplier: 1,
      stagger: 22.5,
      knockback: 500,
    });
  });

  it("builds the effect pool from the drop table groups, leaving out effects the weapon kind cannot roll, by English name", () => {
    expect(data.weapons.axe?.compatible).toEqual([
      { effect: "critical-edge", tiers: [0.1, 0.2, 0.3] },
      { effect: "looting", tiers: [0.2, 0.4, 0.6] },
      { effect: "sharpness", tiers: [0.1, 0.2, 0.3] },
    ]);
    expect(data.weapons.bow?.compatible.map((row) => row.effect)).toEqual(["critical-edge", "looting", "power"]);
  });

  it("reads a unique weapon's built-in effect with its magnitude", () => {
    expect(data.weapons["axe-unique1"]?.fixed).toEqual({ kind: "effect", slug: "reconstruction", value: -0.35 });
  });

  it("falls back to the enchantment book when a built-in enchantment has no entry of its own", () => {
    expect(data.weapons["giant-club-unique1"]?.fixed).toEqual({ kind: "enchantment-book", slug: "flame-belch-unique" });
  });

  it("reads a unique-tier enchantment as its base enchantment when neither it nor its book has an entry", () => {
    expect(data.weapons["shovel-unique1"]?.fixed).toEqual({ kind: "enchantment", slug: "shockwave" });
  });

  it("records how each effect prints its magnitude, only for effects that print it", () => {
    expect(data.effectFormats.reconstruction).toEqual({ percent: true, multiplier: -1, offset: 0, maxFractionDigits: 2 });
    expect(data.effectFormats["status-on-hit-strength"]).toBeUndefined();
  });

  it("matches DataTable rows to entries by their localization id, whatever their row name's casing", () => {
    expect(Object.keys(data.weapons).sort()).toEqual(["axe", "axe-unique1", "bow", "giant-club-unique1", "shovel-unique1"]);
    expect(issues).toEqual([]);
  });
});
