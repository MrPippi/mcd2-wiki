import { describe, expect, it } from "vitest";
import { ExtractError } from "../../../scripts/extract/issues";
import { buildMobs, mobIdFromKey } from "../../../scripts/extract/mobs";
import { makeLocales, ns } from "../../helpers/locales";
import { mobRow, mobTables } from "../../helpers/mob-tables";

const T1 = "DT_MobType1Definition";
const T2 = "DT_MobType2Definition";
const T3 = "DT_MobType3Definition";
const SOUL = "DT_MobSoulStatedDefinition";
const VAR = "DT_MobVariantDefinition";

const locales = makeLocales({
  [ns(T1)]: {
    SW_Mob_Zombie_SW_TextEntry_Name: { en: "Zombie", zh: "殭屍" },
    SW_Mob_Slime_SW_TextEntry_Name: { en: "Slime", zh: "史萊姆" },
    SW_Mob_Bee_SW_TextEntry_Name: { en: "Bee", zh: "蜜蜂" },
  },
  [ns(T2)]: { SW_Mob_Witch_SW_TextEntry_Name: { en: "Witch", zh: "女巫" } },
  [ns(T3)]: {
    SW_Mob_Maw_SW_TextEntry_Name: { en: "Twisted Warden", zh: "扭曲守護者" },
    SW_Mob_Shade_Clone_SW_TextEntry_Name: { en: "Monarch Echo", zh: "君王殘影" },
  },
  [ns(VAR)]: {
    Sw_Mob_ZombieFrozen_SW_TextEntry_Name: { en: "Frozen Zombie", zh: "冰凍殭屍" },
    SW_Mob_Husk_SW_TextEntry_Name: { en: "Husk", zh: "屍殼" },
    SW_Mob_ZombieVariant1_SW_TextEntry_Name: { en: "Zombie", zh: "殭屍" },
  },
});

const HOSTILE = mobRow("DT_MobDefinition", "DefaultHostile", "SW.Mob.Default.Hostile", { unnamed: true });
const MELEE = mobRow("DT_MobDefinition", "MeleeAttackMob", "SW.Mob.Default.MeleeAttackMob", { unnamed: true, traits: ["SW.Mob.Default.Hostile"] });
const ZOMBIE = mobRow(T1, "Zombie", "SW.Mob.Zombie", {
  traits: ["SW.Property.Spawnable", "SW.Mob.Default.MeleeAttackMob", "SW.Mob.Type1", "SW.Mob.Default.Overworld"],
  attrs: { Health: 8, MovementSpeed: 300, Poise: 28, "AI.SightPerceptionRadius": 1000, MeleeAttackSpeed: 1.5, BlastDamageResistanceMultiplier: 1.5, "AI.PerceptionDelayUntilIdle": 2, GravityScale: 1 },
  variants: ["SW.Mob.ZombieVariant1", "Sw.Mob.ZombieFrozen", "SW.Mob.Husk"],
});
const FROZEN = mobRow(VAR, "ZombieFrozen", "Sw.Mob.ZombieFrozen", { key: "Sw_Mob_ZombieFrozen_SW_TextEntry_Name", traits: ["SW.Mob.Zombie", "SW.Mob.Variant.Level1"], attrs: { Health: 12 } });
const HUSK = mobRow(VAR, "Husk", "SW.Mob.Husk", { traits: ["SW.Mob.Zombie"], attrs: { Health: 10 } });
const ZOMBIE_V1 = mobRow(VAR, "ZombieVariant1", "SW.Mob.ZombieVariant1", { traits: ["SW.Mob.Zombie"] });
const SOUL_ZOMBIE = mobRow(SOUL, "SoulStatedZombie", "SW.Mob.Zombie.SoulStated", { unnamed: true, traits: ["SW.Mob.Zombie", "SW.Mob.Default.SoulStated"], attrs: { Health: 12 } });

const base = () => mobTables({ definitions: [HOSTILE, MELEE], type1: [ZOMBIE], variants: [FROZEN, HUSK, ZOMBIE_V1], soulStated: [SOUL_ZOMBIE] });

describe("buildMobs", () => {
  it("builds a regular mob from the base values on its row, keeping only whitelisted stats", () => {
    const zombie = buildMobs(base(), locales).drafts.find((draft) => draft.mob.slug === "zombie")?.mob;
    expect(zombie).toMatchObject({ id: "Zombie", kind: "regular", world: "overworld", name: { en: "Zombie", zh: "殭屍" }, untranslated: [] });
    expect(zombie?.stats).toEqual([
      { key: "health", value: 8 },
      { key: "movementSpeed", value: 300 },
      { key: "poise", value: 28 },
      { key: "sightRadius", value: 1000 },
      { key: "meleeAttackSpeed", value: 1.5 },
      { key: "resistBlast", value: 1.5 },
    ]);
  });

  it("reads the name key from TypeTextData, not the row name: three Slime rows are one mob, and Sw_ keys still resolve", () => {
    const slimes = ["SlimeLarge", "SlimeMedium", "SlimeSmall"].map((name, i) =>
      mobRow(T1, name, i === 0 ? "SW.Mob.Slime" : `SW.Mob.${name}`, { key: "SW_Mob_Slime_SW_TextEntry_Name", traits: ["SW.Mob.Type1"], attrs: { Health: 10 - i } }),
    );
    const result = buildMobs(mobTables({ type1: slimes }), locales);
    expect(result.drafts.map((draft) => draft.mob.slug)).toEqual(["slime"]);
    expect(result.drafts[0]?.tags).toEqual(["SW.Mob.Slime", "SW.Mob.SlimeMedium", "SW.Mob.SlimeSmall"]);
    expect(result.tagIndex.get("sw.mob.slimesmall")).toBe("slime");
    expect(mobIdFromKey("Sw_Mob_ZombieFrozen_SW_TextEntry_Name")).toBe("ZombieFrozen");
    const frozen = buildMobs(base(), locales).drafts.find((draft) => draft.mob.slug === "zombie-frozen");
    expect(frozen?.mob.name.en).toBe("Frozen Zombie");
  });

  it("merges same-kind rows with different name keys but the same English name (the real Slime sizes)", () => {
    const sized = makeLocales({ [ns(T1)]: { SW_Mob_Slime_SW_TextEntry_Name: { en: "Slime" }, SW_Mob_SlimeSmall_SW_TextEntry_Name: { en: "Slime" } } });
    const slimes = [mobRow(T1, "SlimeLarge", "SW.Mob.Slime", { key: "SW_Mob_Slime_SW_TextEntry_Name" }), mobRow(T1, "SlimeSmall", "SW.Mob.SlimeSmall", { key: "SW_Mob_SlimeSmall_SW_TextEntry_Name" })];
    const result = buildMobs(mobTables({ type1: slimes }), sized);
    expect(result.drafts.map((draft) => draft.mob.slug)).toEqual(["slime"]);
    expect(result.drafts[0]?.tags).toEqual(["SW.Mob.Slime", "SW.Mob.SlimeSmall"]);
    expect(result.tagIndex.get("sw.mob.slimesmall")).toBe("slime");
  });

  it("links a variant with its own name both ways, and folds a same-named variant into the base", () => {
    const result = buildMobs(base(), locales);
    const bySlug = new Map(result.drafts.map((draft) => [draft.mob.slug, draft.mob]));
    expect(bySlug.get("zombie")?.variants).toEqual(["zombie-frozen", "husk"]);
    expect(bySlug.get("husk")).toMatchObject({ kind: "variant", variantOf: "zombie", world: "overworld" });
    expect(bySlug.has("zombie-variant1")).toBe(false);
    expect(result.tagIndex.get("sw.mob.zombievariant1")).toBe("zombie");
    expect(result.tagIndex.get("sw.mob.zombiefrozen")).toBe("zombie-frozen");   // Sw. typo and SW. are the same tag
  });

  it("folds the Soul Corrupted version into its base mob instead of making a page", () => {
    const result = buildMobs(base(), locales);
    expect(result.drafts.some((draft) => draft.mob.slug.includes("soul"))).toBe(false);
    const zombie = result.drafts.find((draft) => draft.mob.slug === "zombie");
    expect(zombie?.mob.soulCorrupted).toEqual({ stats: [{ key: "health", value: 12 }], drops: [] });
    expect(zombie?.soul?.tags).toEqual(["SW.Mob.Zombie.SoulStated"]);
    expect(result.tagIndex.get("sw.mob.zombie.soulstated")).toBe("zombie");
    expect(zombie?.references.at(-1)).toContain("SoulStatedZombie");
  });

  it("gives a mob without a Soul Corrupted version no such section", () => {
    const bee = mobRow(T1, "Bee", "SW.Mob.Bee", { traits: ["SW.Mob.Type1"], attrs: { Health: 4 } });
    const drafts = buildMobs(mobTables({ type1: [bee] }), locales).drafts;
    expect(drafts[0]?.mob.soulCorrupted).toBeUndefined();
  });

  it("takes the kind from the table: Type2 is a mini-boss and Type3 a boss", () => {
    const witch = mobRow(T2, "Witch", "SW.Mob.Witch", { traits: ["SW.Mob.Default.Type2"] });
    const maw = mobRow(T3, "Maw", "SW.Mob.Maw", { traits: ["SW.Mob.Default.Type3"] });
    const kinds = buildMobs(mobTables({ type2: [witch], type3: [maw] }), locales).drafts.map((draft) => [draft.mob.slug, draft.mob.kind]);
    expect(kinds).toEqual([["maw", "boss"], ["witch", "miniboss"]]);
  });

  it("skips abstract rows and the loot-less clone, and reports why", () => {
    const abstract = mobRow(T3, "DefaultMobType3", "SW.Mob.Default.Type3", { unnamed: true });
    const clone = mobRow(T3, "Shade_Clone", "SW.Mob.Shade_Clone", { traits: ["SW.Mob.Shade", "SW.Trait.CannotDropLoot"] });
    const result = buildMobs(mobTables({ type3: [abstract, clone] }), locales);
    expect(result.drafts).toEqual([]);
    expect(result.issues).toContainEqual({ type: "mob-skipped", detail: "Shade_Clone: CannotDropLoot" });
  });

  it("reports a mob with no English name and does not publish it", () => {
    const ghost = mobRow(T1, "Ghost", "SW.Mob.Ghost", { traits: ["SW.Mob.Type1"] });
    const result = buildMobs(mobTables({ type1: [ghost] }), locales);
    expect(result.drafts).toEqual([]);
    expect(result.issues.map((item) => item.type)).toContain("mob-unnamed");
  });

  it("shows English and records the language when a name is missing in it", () => {
    const withoutDe = { ...locales, de: {} };
    const zombie = buildMobs(base(), withoutDe).drafts.find((draft) => draft.mob.slug === "zombie")?.mob;
    expect(zombie?.name.de).toBe("Zombie");
    expect(zombie?.untranslated).toEqual(["de"]);
  });

  it("fails when two different mobs would share a slug", () => {
    const a = mobRow(T1, "FooBar", "SW.Mob.FooBar", { key: "SW_Mob_FooBar_SW_TextEntry_Name" });
    const b = mobRow(T1, "Foo_Bar", "SW.Mob.Foo_Bar", { key: "SW_Mob_Foo_Bar_SW_TextEntry_Name" });
    const dupLocales = makeLocales({ [ns(T1)]: { SW_Mob_FooBar_SW_TextEntry_Name: { en: "Foo" }, SW_Mob_Foo_Bar_SW_TextEntry_Name: { en: "Bar" } } });
    expect(() => buildMobs(mobTables({ type1: [a, b] }), dupLocales)).toThrow(ExtractError);
  });
});
