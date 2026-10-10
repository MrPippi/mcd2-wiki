/** Small hand-made DataTable rows in the game's export shape, for weapon extraction tests. */
import type { WeaponTables } from "../../scripts/extract/weapon-tables";

const tags = (...names: string[]) => ({ GameplayTags: names.map((TagName) => ({ TagName })) });
const loc = (table: string, key: string) => ({ Text: `LOCTABLE("${table}.csv", "${key}")` });
const anyOf = (...names: string[]) => ({
  TagDictionary: names.map((TagName) => ({ TagName })),
  QueryTokenStream: [0, 1, 1, names.length, ...names.map((_, i) => i)],
});

const item = (id: string, traits: string[], effects: string[] = []) => ({
  Name: id,
  Traits: tags(...traits),
  Effects: tags(...effects),
  TypeTextData: { Texts: { '(TagName="SW.TextEntry.Name")': loc("DT_ItemDefinitionMelee", `SW_Item_${id}_SW_TextEntry_Name`) } },
});

const swing = (damage: number, stagger: number, range: number, knockback: number) => ({
  Damage: damage,
  Stagger: stagger,
  AttackRange: range,
  VariantLoopAmount: 1,
  Knockback: { Strength: knockback },
});

const tiered = (effect: string, base: string, values: [number, number, number]) =>
  (["I", "II", "III"] as const).map((tier, i) => ({
    Name: `${effect}${tier}`,
    TypeTag: { TagName: `SW.EffectTemplate.${effect}.${tier}` },
    Traits: tags(`SW.EffectTemplate.Tier${i + 1}`, base, `SW.Effect.${effect}`),
    TemplateData: { Effect: { TagName: `SW.Effect.${effect}` }, FixedEffectValue: values[i] },
  }));

const effect = (name: string, locId: string, format?: { multiplier?: number; percent?: boolean }) => ({
  Name: name,
  TypeTag: { TagName: `SW.Effect.${name}` },
  TypeTextData: {
    Texts: {
      '(TagName="SW.TextEntry.Name")': loc("DT_EffectDefinition", `SW_Effect_${locId}_SW_TextEntry_Name`),
      '(TagName="SW.TextEntry.Description")': {
        ...loc("DT_EffectDefinition", `SW_Effect_${locId}_SW_TextEntry_Description`),
        DynamicDataGetterFunction: { TagName: format ? "SW.TextEntry.DataGetter.GetEffectMagnitude" : "SW.TextEntry.DataGetter.GetAbilityKeyValues" },
        ValuesToGet: [
          { FormattingData: { IsPercentage: format?.percent ?? true, Multiplier: format?.multiplier ?? 1, Offset: 0, MaxFractionalDigits: 2 } },
        ],
      },
    },
  },
});

export const TABLES: WeaponTables = {
  items: [
    item("Axe", ["SW.Item.Property.MeleeWeapon", "SW.Item.Property.MediumWeapon", "SW.Archetype.Ranger"]),
    item("Axe_Unique1", ["SW.Item.Property.MeleeWeapon", "SW.Item.Property.Unique"], ["SW.EffectTemplate.Reconstruction.Unique"]),
    item("GiantClub_Unique1", ["SW.Item.Property.MeleeWeapon", "SW.Item.Property.Unique"], ["SW.Enchantment.FlameBelch.Unique"]),
    item("Bow", ["SW.Item.Property.RangedWeapon", "SW.Item.Property.LightWeapon", "SW.Item.Property.Bow"]),
    item("Shovel_Unique1", ["SW.Item.Property.MeleeWeapon", "SW.Item.Property.Unique"], ["SW.Enchantment.Shockwave.Unique"]),
  ],
  melee: [
    {
      Name: "Axe",
      AttackVariants: { Variants: [swing(14, 27.5, 250, 500), swing(22, 45, 350, 700)] },
      JumpAttackDefinition: { Damage: 21, Stagger: 42.5, AreaOfEffectSplashRange: 250, Knockback: { Strength: 1250 } },
    },
  ],
  ranged: [
    {
      Name: "Bow",
      AttackDefintion: {
        Range: 750,
        MaxAmmo: 15,
        RechargeTimeSeconds: 1.2,
        AttackRateSeconds: 0.4,
        ChargeTimeSecond: 0.35,
        ChargeDamageMultiplier: 3,
        JumpshotDamageMultiplier: 1,
        ProjectileDamageFactor: 1,
        VolleyDefinitions: [{ ProjectileDefinitions: [{ ProjectileTypeTag: { TagName: "SW.Projectile.Type.PlayerBow" }, NumberOfProjectiles: 1 }] }],
      },
    },
  ],
  projectiles: [
    { TypeTag: { TagName: "SW.Projectile.Type.PlayerBow" }, ProjectileGameplayData: { damage: 18, Stagger: 22.5, knockback: { Strength: 500 } } },
  ],
  templates: [
    { Name: "MeleeWeaponEffectTemplate", TypeTag: { TagName: "SW.EffectTemplate.MeleeWeapon" }, TemplateData: { IncompatibleTagsQuery: anyOf("SW.Item.Property.RangedWeapon") } },
    { Name: "RangedWeaponEffectTemplate", TypeTag: { TagName: "SW.EffectTemplate.RangedWeapon" }, TemplateData: { IncompatibleTagsQuery: anyOf("SW.Item.Property.MeleeWeapon") } },
    ...tiered("Sharpness", "SW.EffectTemplate.MeleeWeapon", [0.1, 0.2, 0.3]),
    ...tiered("Power", "SW.EffectTemplate.RangedWeapon", [0.1, 0.2, 0.3]),
    ...tiered("CriticalEdge", "SW.EffectTemplate.Weapon", [0.1, 0.2, 0.3]),
    ...tiered("Looting", "SW.EffectTemplate.Weapon", [0.2, 0.4, 0.6]),
    {
      Name: "ReconstructionUnique",
      TypeTag: { TagName: "SW.EffectTemplate.Reconstruction.Unique" },
      Traits: tags("SW.EffectTemplate.TierUnique", "SW.Effect.Reconstruction"),
      TemplateData: { Effect: { TagName: "SW.Effect.Reconstruction" }, FixedEffectValue: -0.35 },
    },
  ],
  groups: [
    {
      TypeTag: { TagName: "SW.EffectTemplateGroup.Weapon" },
      TagList: { Tags: ["Sharpness", "Power", "CriticalEdge"].flatMap((e) => ["I", "II", "III"].map((t) => ({ TypeTag: { TagName: `SW.EffectTemplate.${e}.${t}` } }))) },
    },
    {
      TypeTag: { TagName: "SW.EffectTemplateGroup.Archetype.Utility" },
      TagList: { Tags: ["I", "II", "III"].map((t) => ({ TypeTag: { TagName: `SW.EffectTemplate.Looting.${t}` } })) },
    },
  ],
  dropTable: [
    { TypeTag: { TagName: "SW.Item.Property.Gear" }, PrimaryETG: { Tags: [{ TypeTag: { TagName: "SW.EffectTemplateGroup.Archetype.Utility" } }] } },
    { TypeTag: { TagName: "SW.Item.Property.MeleeWeapon" }, PrimaryETG: { Tags: [{ TypeTag: { TagName: "SW.EffectTemplateGroup.Weapon" } }] } },
    { TypeTag: { TagName: "SW.Item.Property.RangedWeapon" }, PrimaryETG: { Tags: [{ TypeTag: { TagName: "SW.EffectTemplateGroup.Weapon" } }] } },
  ],
  effects: [
    effect("Sharpness", "Sharpness", {}),
    effect("Power", "Power", {}),
    effect("CriticalEdge", "CriticalEdge", {}),
    effect("Looting", "Looting", {}),
    effect("Reconstruction", "Reconstruction", { multiplier: -1 }),
    effect("StrengthOnHit", "StatusOnHit_Strength"),
  ],
  // Unique-tier enchantment rows carry no texts in the game data, only a row name.
  enchantments: [
    { Name: "FlameBelch.Unique", TypeTag: { TagName: "SW.Enchantment.FlameBelch.Unique" } },
    { Name: "Shockwave.Unique", TypeTag: { TagName: "SW.Enchantment.Shockwave.Unique" } },
  ],
};
