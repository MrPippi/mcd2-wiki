import { describe, expect, it } from "vitest";
import { buildSoulEnchantments, exclusionsByRow, modifiersOf, tierKeyValues } from "../../../scripts/extract/soul-enchantments";
import {
  ExcluderRowSchema,
  ExcludingWaveRowSchema,
  SoulEnchantmentRowSchema,
  type SoulEnchantmentRow,
  type SoulEnchantmentTables,
} from "../../../scripts/extract/soul-enchantment-tables";
import { EMPTY_QUESTS, type QuestData } from "../../../shared/quest-schema";
import { makeLocales, ns } from "../../helpers/locales";

const PREFIX = "SW.Enchantment.SoulEnchantment";
const tags = (...names: string[]) => ({ GameplayTags: names.map((TagName) => ({ TagName })) });
const scalable = (Value: number) => ({ MagnitudeCalculationType: "ScalableFloat", ScalableFloatMagnitude: { Value } });
const modifier = (AttributeName: string, ModifierOp: string, value: number) => ({ Attribute: { AttributeName }, ModifierOp, ModifierMagnitude: scalable(value) });
const keyValue = (tag: string, value: number, type: "Float" | "Int" = "Float") => ({ TypeTag: { TagName: `SW.KeyValue.${tag}` }, Type: type, [type]: value });
const threat = (min = 0, max = 20) => ({ MinimumThreatLevel: min, MaximumThreatLevel: max });
const nameText = (family: string) => ({
  Texts: { '(TagName="SW.TextEntry.Name")': { Text: `LOCTABLE("DT_SoulEnchantmentDefinition.csv", "SW_Enchantment_SoulEnchantment_${family}_SW_TextEntry_Name")` } },
});

const row = (fields: Record<string, unknown>): SoulEnchantmentRow => SoulEnchantmentRowSchema.parse({ ThreatLevelSettings: threat(), ...fields });

const SOUL_ORBS = row({
  Name: "SoulOrbs",
  TypeTag: { TagName: `${PREFIX}.SoulOrbs` },
  TypeTextData: nameText("SoulOrbs"),
  IconReference: "/OreUI/UI/Icons/SoulStated/T_UI_Icon_SoulStated_SoulOrbs.T_UI_Icon_SoulStated_SoulOrbs",
  GameplayEffect: { Modifiers: [modifier("ElementalDamageResistanceMultiplier", "MultiplyAdditive", 1.5)] },
  Abilities: [{
    Ability: "/Script/SpicewoodGAS.GA_SoulOrbs",
    SpecificKeyValues: [keyValue("ChargeDuration", 3), keyValue("Damage", 0), keyValue("Range", 750), keyValue("NumberOfProjectiles", 1, "Int"), keyValue("AngleSpan", 0)],
    CommonKeyValues: [keyValue("ActivationChance", 100, "Int")],
  }],
});
const tier = (name: string, fields: Record<string, unknown>): SoulEnchantmentRow =>
  row({ Name: `SoulOrbs.${name}`, TypeTag: { TagName: `${PREFIX}.SoulOrbs.${name}` }, Traits: tags(`${PREFIX}.SoulOrbs`, `${PREFIX}.Level.${name}`), ...fields });
const specialize = (values: readonly { KeyValue: unknown; ModOp: string }[]) => ({
  AbilitySpecialization: { Specializations: [{ Ability: "/Script/SpicewoodGAS.GA_SoulOrbs", KeyValueSpecializations: values }] },
});

const TIERS = [
  tier("I", { ThreatLevelSettings: threat(5), GameplayEffect: { Modifiers: [modifier("ElementalDamageResistanceMultiplier", "MultiplyAdditive", 1.5), modifier("Health", "AddBase", 0)] } }),
  tier("II", specialize([{ KeyValue: keyValue("Damage", 7), ModOp: "Override" }, { KeyValue: keyValue("NumberOfProjectiles", 2, "Int"), ModOp: "Override" }])),
  tier("III", specialize([{ KeyValue: keyValue("Damage", 9), ModOp: "Override" }, { KeyValue: keyValue("Range", 50), ModOp: "Add" }])),
];
const LEVEL = row({ Name: "Lvl.I", TypeTag: { TagName: `${PREFIX}.Level.I` }, GameplayEffect: { Modifiers: [modifier("HealthMax", "MultiplyAdditive", 1.25)] } });
const OTHER = [
  row({ Name: "SoulEnchantmentBase", TypeTag: { TagName: PREFIX } }),
  row({ Name: "Default", TypeTag: { TagName: `${PREFIX}.Default` }, TypeTextData: nameText("Default") }),
];

const excluder = (Name: string, TypeTag: string, traits: string[], excluded: string[] = []) =>
  ExcluderRowSchema.parse({ Name, TypeTag: { TagName: TypeTag }, Traits: tags(...traits), ...(excluded.length > 0 ? { MobConditions: { ExcludedSoulEnchantments: tags(...excluded) } } : {}) });

const SOUL_STATED = [
  excluder("SoulStatedZombie", "SW.Mob.Zombie.SoulStated", ["SW.Mob.Zombie", "SW.Mob.Default.SoulStated"]),
  excluder("SoulStatedHusk", "SW.Mob.Husk.SoulStated", ["SW.Mob.Default.SoulStated", "SW.Mob.Husk"]),
  excluder("SoulStatedZombieVariant1", "SW.Mob.ZombieVariant1.SoulStated", ["SW.Mob.Default.SoulStated", "SW.Mob.ZombieVariant1"]),
  excluder("SoulStatedGeomancer", "SW.Mob.Geomancer.SoulStated", ["SW.Mob.Default.SoulStated"], [`${PREFIX}.SoulOrbs`]),
  excluder("SoulStatedNobody", "SW.Mob.Nobody.SoulStated", ["SW.Mob.Default.SoulStated"], [`${PREFIX}.SoulOrbs`]),
];
const VARIANTS = [
  excluder("Husk", "SW.Mob.Husk", ["SW.Mob.Zombie"], [`${PREFIX}.SoulOrbs`]),
  excluder("ZombieVariant1", "SW.Mob.ZombieVariant1", ["SW.Mob.Zombie"], [`${PREFIX}.SoulOrbs`]),
];
const WAVES = [
  ExcludingWaveRowSchema.parse({ Name: "ForestA1_CA04_Arena03_Mobs", TypeTag: { TagName: "SW.ArenaWave.ForestA1.CA04.Arena.03" }, SpawnWaveDefinition: { ExcludedSoulEnchantmentsOverride: tags(`${PREFIX}.SoulOrbs`) } }),
  ExcludingWaveRowSchema.parse({ Name: "Plain", TypeTag: { TagName: "SW.ArenaWave.X" }, SpawnWaveDefinition: {} }),
];

const MOB_SLUGS = new Map([
  ["sw.mob.zombie.soulstated", "zombie"],
  ["sw.mob.zombievariant1.soulstated", "zombie"],
  ["sw.mob.husk.soulstated", "husk"],
  ["sw.mob.geomancer.soulstated", "geomancer"],
]);
const QUESTS = { ...EMPTY_QUESTS, quests: [{ slug: "ca04", id: "CA04" }] } as unknown as QuestData;

const LOCALES = makeLocales({
  [ns("DT_SoulEnchantmentDefinition")]: { SW_Enchantment_SoulEnchantment_SoulOrbs_SW_TextEntry_Name: { en: "Orb Caster", zh: "寶珠施放" } },
});

const tables = (enchantments: readonly SoulEnchantmentRow[]): SoulEnchantmentTables => ({ enchantments, soulStated: SOUL_STATED, variants: VARIANTS, waves: WAVES });
const build = (enchantments: readonly SoulEnchantmentRow[] = [...OTHER, SOUL_ORBS, ...TIERS, LEVEL]) =>
  buildSoulEnchantments({ tables: tables(enchantments), locales: LOCALES, mobSlugs: MOB_SLUGS, quests: QUESTS, iconOf: (_row, slug) => `icons/soul-enchantments/${slug}.png`, verified: false });

describe("modifiersOf", () => {
  it("maps the game's attributes and operations and drops a +0", () => {
    expect(modifiersOf(TIERS[0])).toEqual({ modifiers: [{ attribute: "resistElemental", op: "multiply", value: 1.5 }], issues: [] });
  });

  it("reads MultiplyCompound as a multiplier and reports what it cannot show", () => {
    const odd = row({
      Name: "Odd.I",
      TypeTag: { TagName: `${PREFIX}.Odd.I` },
      GameplayEffect: { Modifiers: [modifier("Poise", "MultiplyCompound", 0.75), modifier("Mystery", "AddBase", 1), modifier("HealthMax", "Override", 2)] },
    });
    const result = modifiersOf(odd);
    expect(result.modifiers).toEqual([{ attribute: "poise", op: "multiply", value: 0.75 }]);
    expect(result.issues.map((one) => one.type)).toEqual(["soul-enchantment-ignored", "soul-enchantment-ignored"]);
  });
});

describe("tierKeyValues", () => {
  it("applies a tier's Override and Add to the family ability's key values", () => {
    const values = tierKeyValues(SOUL_ORBS.Abilities ?? [], TIERS[2]).get("GA_SoulOrbs");
    expect(values?.get("Damage")).toBe(9);
    expect(values?.get("Range")).toBe(800);
    expect(values?.get("NumberOfProjectiles")).toBe(1);
  });
});

describe("exclusionsByRow", () => {
  it("inherits a variant row's exclusions through the trait closure", () => {
    const byRow = exclusionsByRow([...SOUL_STATED, ...VARIANTS]);
    expect([...(byRow.get(SOUL_STATED[1]) ?? [])]).toEqual(["sw.enchantment.soulenchantment.soulorbs"]);
    expect(byRow.get(SOUL_STATED[0])?.size).toBe(0);
  });
});

describe("buildSoulEnchantments", () => {
  it("builds one family with its tiers in order, shown values converted, and the generic level rows", () => {
    const { data } = build();
    expect(data.families.map((family) => family.slug)).toEqual(["soul-orbs"]);
    const [family] = data.families;
    expect(family.name.zh).toBe("寶珠施放");
    expect(family.icon).toBe("icons/soul-enchantments/soul-orbs.png");
    expect(family.tiers.map((one) => one.tier)).toEqual(["I", "II", "III"]);
    expect(family.tiers[0].threat).toEqual({ min: 5, max: 20 });
    expect(family.tiers[0].ability).toEqual([
      { key: "orbCount", value: 1 }, { key: "orbDamage", value: 0 }, { key: "orbCharge", value: 3 }, { key: "orbRange", value: 7.5 },
    ]);
    expect(family.tiers[1].modifiers).toEqual([]);
    expect(family.tiers[1].ability.find((one) => one.key === "orbCount")?.value).toBe(2);
    expect(family.tiers[2].ability.find((one) => one.key === "orbRange")?.value).toBe(8);
    expect(data.levels).toEqual([{ tier: "I", modifiers: [{ attribute: "healthMax", op: "multiply", value: 1.25 }] }]);
  });

  it("lists excluding mobs once, marks a page where only some rows exclude, and links the arena's quest", () => {
    const { data, issues } = build();
    expect(data.families[0].excludedMobs).toEqual([
      { slug: "husk", partial: false },
      { slug: "zombie", partial: true },
      { slug: "geomancer", partial: false },
    ]);
    expect(data.families[0].excludedQuests).toEqual(["ca04"]);
    expect(issues).toEqual([{ type: "soul-enchantment-unlinked", detail: "SoulStatedNobody: no bestiary page" }]);
  });

  it("reports a missing tier row and a family without a name", () => {
    const unnamed = row({ Name: "Ghost", TypeTag: { TagName: `${PREFIX}.Ghost` } });
    const { data, issues } = build([SOUL_ORBS, TIERS[0], unnamed]);
    expect(data.families[0].tiers.map((one) => one.tier)).toEqual(["I"]);
    expect(issues).toContainEqual({ type: "soul-enchantment-ignored", detail: "SoulOrbs: no II row" });
    expect(issues).toContainEqual({ type: "soul-enchantment-unnamed", detail: "Ghost" });
  });

  it("reports an ability whose values the page does not know", () => {
    const strange = row({ ...SOUL_ORBS, Abilities: [{ Ability: "/Script/SpicewoodGAS.GA_Strange" }] });
    const { issues } = build([strange, ...TIERS]);
    expect(issues).toContainEqual({ type: "soul-enchantment-ignored", detail: "SoulOrbs.I: ability GA_Strange" });
  });
});
