/** Small hand-made DataTable rows in the game's export shape, for weapon extraction tests. */
import type { GameTables } from "../../scripts/extract/game-tables";

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

const ability = (name: string, values: Record<string, number>) => ({
  Ability: `/Script/SpicewoodGAS.${name}`,
  SpecificKeyValues: Object.entries(values).map(([key, value]) => ({ TypeTag: { TagName: `SW.KeyValue.${key}` }, Float: value })),
});
const keyValue = (key: string, value: number) => ({ TypeTag: { TagName: `SW.KeyValue.${key}` }, Float: value });
const override = (key: string, value: number) => ({ KeyValue: keyValue(key, value), ModOp: "Override" });
const add = (key: string, value: number) => ({ KeyValue: keyValue(key, value), ModOp: "Add" });
const enchantTier = (family: string, tier: string, specs: ReturnType<typeof override>[]) => ({
  Name: `${family}.${tier}`,
  TypeTag: { TagName: `SW.Enchantment.${family}.${tier}` },
  Traits: tags(`SW.Enchantment.${family}`, `SW.Effect.Tier.${tier === "Unique" ? "Unique" : ["I", "II", "III"].indexOf(tier) + 1}`),
  AbilitySpecialization: specs.length > 0 ? { Specializations: [{ Ability: "/Script/SpicewoodGAS.GA_ElementalBlast", KeyValueSpecializations: specs }] } : {},
});
const valueText = (id: string, getter: string, key: string | undefined, percent: boolean) => ({
  Texts: {
    '(TagName="SW.TextEntry.Name")': loc("DT_EnchantmentDefinition", `SW_Enchantment_${id}_SW_TextEntry_Name`),
    '(TagName="SW.TextEntry.Description")': {
      ...loc("DT_EnchantmentDefinition", `SW_Enchantment_${id}_SW_TextEntry_Description`),
      DynamicDataGetterFunction: { TagName: `SW.TextEntry.DataGetter.${getter}` },
      ValuesToGet: [
        {
          ...(key ? { TagToExtractFrom: { TagName: `SW.KeyValue.${key}` } } : {}),
          FormattingData: { IsPercentage: percent, Multiplier: percent ? 1 : 0.01, Offset: 0, MaxFractionalDigits: 2 },
        },
      ],
    },
  },
});
const abilityText = (id: string, key: string, percent = true) => valueText(id, "GetAbilityKeyValues", key, percent);
const magnitudeText = (id: string) => valueText(id, "GetEffectMagnitude", undefined, true);

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

export const TABLES: GameTables = {
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
    { Name: "ArtifactEffectTemplate", TypeTag: { TagName: "SW.EffectTemplate.Artifact" }, TemplateData: { IncompatibleTagsQuery: anyOf("SW.Item.Property.MeleeWeapon", "SW.Item.Property.RangedWeapon") } },
    ...tiered("Cooldown", "SW.EffectTemplate.Artifact", [-0.1, -0.15, -0.2]),
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
      TypeTag: { TagName: "SW.EffectTemplateGroup.Artifact" },
      TagList: { Tags: ["I", "II", "III"].map((t) => ({ TypeTag: { TagName: `SW.EffectTemplate.Cooldown.${t}` } })) },
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
    { TypeTag: { TagName: "SW.Item.Property.Artifact" }, PrimaryETG: { Tags: [{ TypeTag: { TagName: "SW.EffectTemplateGroup.Artifact" } }] } },
  ],
  effects: [
    effect("Sharpness", "Sharpness", {}),
    effect("Power", "Power", {}),
    effect("CriticalEdge", "CriticalEdge", {}),
    effect("Looting", "Looting", {}),
    effect("Cooldown", "Cooldown", { multiplier: -1 }),
    effect("Reconstruction", "Reconstruction", { multiplier: -1 }),
    effect("StrengthOnHit", "StatusOnHit_Strength"),
  ],
  enchantments: [
    // FireAspect: description reads the ability's DamageMultiplier; tiers override it, and add to MaxRange.
    {
      Name: "FireAspect",
      TypeTag: { TagName: "SW.Enchantment.FireAspect" },
      Traits: tags("SW.Enchantment"),
      TypeTextData: abilityText("FireAspect", "DamageMultiplier"),
      Abilities: [ability("GA_ElementalBlast", { DamageMultiplier: 0.35, MaxRange: 550 })],
      EnchantmentData: { RelevantSlots: { GameplayTags: [{ TagName: "SW.ItemSlot.Equipment.MeleeWeapon" }] } },
    },
    enchantTier("FireAspect", "I", []),
    enchantTier("FireAspect", "II", [override("DamageMultiplier", 0.45), add("MaxRange", 50)]),
    enchantTier("FireAspect", "III", [override("DamageMultiplier", 0.55)]),
    // Unique-tier rows carry no texts, only a row name and the family they belong to.
    { ...enchantTier("FireAspect", "Unique", [override("DamageMultiplier", 0.8)]), Name: "FlameBelch.Unique", TypeTag: { TagName: "SW.Enchantment.FlameBelch.Unique" } },
    // Ricochet: description reads the template magnitude of each tier.
    {
      Name: "Ricochet",
      TypeTag: { TagName: "SW.Enchantment.Ricochet" },
      Traits: tags("SW.Enchantment"),
      TypeTextData: magnitudeText("Ricochet"),
      EnchantmentData: {
        RelevantSlots: {
          GameplayTags: ["Armor.Helmet", "Armor.Chest", "Armor.Leggings", "Armor.Boots", "RangedWeapon", "Backpack"].map((slot) => ({ TagName: `SW.ItemSlot.Equipment.${slot}` })),
        },
      },
    },
    ...(["I", "II", "III"] as const).map((tier, i) => ({ ...enchantTier("Ricochet", tier, []), TemplateData: { FixedEffectValue: [0.1, 0.16, 0.22][i] } })),
    // GuardingStrike: like the real row, it names no gear slot.
    { Name: "GuardingStrike", TypeTag: { TagName: "SW.Enchantment.GuardingStrike" }, Traits: tags("SW.Enchantment"), TypeTextData: magnitudeText("GuardingStrike") },
    ...(["I", "II", "III"] as const).map((tier, i) => ({ ...enchantTier("GuardingStrike", tier, []), TemplateData: { FixedEffectValue: [0.1, 0.2, 0.3][i] } })),
    // GravityPulse.Unique: its own entry, texts and ability.
    {
      Name: "GravityPulse.Unique",
      TypeTag: { TagName: "SW.Enchantment.GravityPulse.Unique" },
      Traits: tags("SW.Enchantment.GravityPulse", "SW.Effect.Tier.Unique"),
      TypeTextData: abilityText("GravityPulse_Unique", "MaxRange", false),
      Abilities: [ability("GA_GravityWell", { MaxRange: 700 })],
    },
    { Name: "Shockwave.Unique", TypeTag: { TagName: "SW.Enchantment.Shockwave.Unique" } },
    // ShadowStrike: an Int key value is a whole percentage already (8 means 8%).
    {
      Name: "ShadowStrike",
      TypeTag: { TagName: "SW.Enchantment.ShadowStrike" },
      Traits: tags("SW.Enchantment"),
      TypeTextData: abilityText("ShadowStrike", "ActivationChance"),
      Abilities: [{ Ability: "/Script/SpicewoodGAS.GA_Shadow", SpecificKeyValues: [{ TypeTag: { TagName: "SW.KeyValue.ActivationChance" }, Int: 8 }] }],
    },
    enchantTier("ShadowStrike", "I", []),
  ],
  armor: [
    // A row the site has no entry for (an unreleased piece): skipped.
    { ...item("NoEntryBoots", ["SW.Item.Property.Armor.Boots"]), TypeTextData: { Texts: { '(TagName="SW.TextEntry.Name")': loc("DT_ItemDefinitionArmor", "SW_Item_NoEntryBoots_SW_TextEntry_Name") } } },
    { ...item("HunterHelmet", ["SW.Item.Property.Armor.Helmet", "SW.Item.Property.LightArmor"]), TypeTextData: { Texts: { '(TagName="SW.TextEntry.Name")': loc("DT_ItemDefinitionArmor", "SW_Item_HunterHelmet_SW_TextEntry_Name") } } },
    {
      ...item("HunterHelmet_Unique", ["SW.Item.Property.Armor.Helmet"], ["SW.EffectTemplate.Reconstruction.Unique"]),
      TypeTextData: { Texts: { '(TagName="SW.TextEntry.Name")': loc("DT_ItemDefinitionArmor", "SW_Item_HunterHelmet_Unique_SW_TextEntry_Name") } },
    },
  ],
  artifacts: [
    {
      Name: "TotemOfShielding",
      Traits: tags("SW.Item.Property.Artifact", "SW.Archetype.Tank"),
      TypeTextData: { Texts: { '(TagName="SW.TextEntry.Name")': loc("DT_ItemDefinitionArtifact", "SW_Item_Artifact_TotemOfShielding_SW_TextEntry_Name") } },
      KeyValues: [keyValue("CooldownDuration", 24), keyValue("SoulArtifact.ActivationCost", 40), keyValue("Lifetime", 10), keyValue("EffectiveRange", 1200)],
    },
    {
      Name: "FireworkQuiver",
      Traits: tags("SW.Item.Artifact.Quiver"),
      TypeTextData: { Texts: { '(TagName="SW.TextEntry.Name")': loc("DT_ItemDefinitionArtifact", "SW_Item_Artifact_FireworkQuiver_SW_TextEntry_Name") } },
      KeyValues: [keyValue("CooldownDuration", 15), { TypeTag: { TagName: "SW.KeyValue.SoulArtifact.ActivationCost" }, Int: 20 }],
    },
  ],
};
