/** Hand-made talisman DataTable rows in the game's export shape (values copied from the real tables). */
import type { GameTables } from "../../scripts/extract/game-tables";
import type { TalismanTables } from "../../scripts/extract/talisman-tables";
import type { Entry, Localized } from "../../shared/schemas";
import { loc } from "./localized";

const tag = (TagName: string) => ({ TagName });
const tags = (...names: string[]) => ({ GameplayTags: names.map(tag) });
const text = (table: string, key: string, getter = "None") => ({
  Text: `LOCTABLE("${table}.csv", "${key}")`,
  DynamicDataGetterFunction: tag(getter),
});
const talismanTexts = (id: string, getter = "None", prefix = "SW") => ({
  Texts: {
    '(TagName="SW.TextEntry.Name")': text("DT_ItemDefinitionTalisman", `${prefix}_Item_Talisman_${id}_SW_TextEntry_Name`),
    '(TagName="SW.TextEntry.Description")': text("DT_ItemDefinitionTalisman", `${prefix}_Item_Talisman_${id}_SW_TextEntry_Description`, getter),
  },
});

const companion = (levels: [number, number, number][]) => [
  {
    Ability: "/Script/SpicewoodGAS.GA_SpawnCompanion",
    CommonKeyValues: [
      { TypeTag: tag("SW.KeyValue.ActivationChance"), Type: "Int", Int: 100 },
      { TypeTag: tag("SW.KeyValue.CooldownDuration"), Type: "Float", Float: 30 },
    ],
    InstanceData: [
      Object.fromEntries(
        (["LevelOne", "LevelTwo", "LevelThree"] as const).map((key, i) => {
          const [attack, defence, cooldown] = levels[i] ?? [1, 1, 1];
          return [key, { AttackMultiplier: attack, DefenceMultiplier: defence, CooldownMultiplier: cooldown }];
        }),
      ),
    ],
  },
];

const item = (name: string, typeTag: string, texts: ReturnType<typeof talismanTexts>, extra: object = {}) => ({
  Name: name,
  TypeTag: tag(typeTag),
  Traits: tags("SW.Item.Property.Talisman"),
  TypeTextData: texts,
  ...extra,
});

const XP = [18480, 73920, 0];
const effectLevels = (family: string) =>
  (["I", "II", "III"] as const).map((tier, i) => ({
    Level: tag(`SW.Item.Property.Level.${i + 1}`),
    XPRequiredForNextLevel: XP[i],
    Effects: tags(`SW.EffectTemplate.${family}.${tier}`),
  }));
const grantedLevels = (family: string) =>
  [1, 2, 3].map((level, i) => ({
    Level: tag(`SW.Item.Property.Level.${level}`),
    XPRequiredForNextLevel: XP[i],
    GrantedTags: tags(`SW.Talisman.${family}.Level.${level}`),
  }));
type Levels = NonNullable<NonNullable<TalismanTables["properties"][number]["ItemLevels"]>["Levels"]>;
const property = (name: string, typeTag: string, levels: Levels) => ({ Name: name, TypeTag: tag(typeTag), ItemLevels: { Levels: levels } });

const templates = (family: string, effect: string, values: [number, number, number], extra: object = {}) =>
  (["I", "II", "III"] as const).map((tier, i) => ({
    Name: `Talisman${family}${tier}`,
    TypeTag: tag(`SW.EffectTemplate.${family}.${tier}`),
    TemplateData: { Effect: tag(effect), HasFixedEffectValue: true, FixedEffectValue: values[i], MinimumRequiredItemPower: 0, ...extra },
  }));

export const TALISMAN_TABLES: TalismanTables = {
  items: [
    item("AmmoCapacityTalisman", "SW.Item.Talisman.AmmoCapacity", talismanTexts("AmmoCapacity")),
    item("PotionCooldownTalisman", "SW.Item.Talisman.PotionCooldown", talismanTexts("PotionCooldown")),
    item("RangedBuffTalisman", "SW.Item.Talisman.RangedBuff", talismanTexts("RangedBuff")),
    item("HealthyStrikeTalisman", "SW.Item.Talisman.HealthyStrike", talismanTexts("HealthyStrike", "SW.TextEntry.DataGetter.GetHealthyStrikeValues")),
    item("WolfTalisman", "SW.Item.Talisman.Wolf", talismanTexts("Wolf"), { GrantedAbilities: companion([[1, 1, 1], [1.2, 0.8, 0.8], [1.65, 0.5, 0.75]]) }),
    // The game writes this one's tag and text keys with a lower-case "sw".
    item("LlamaTalisman", "sw.Item.Talisman.Llama", talismanTexts("Llama", "None", "sw"), { GrantedAbilities: companion([[1, 1, 1], [1.2, 0.8, 0.8], [1.5, 0.5, 0.75]]) }),
    item("RolledTalisman", "SW.Item.Talisman.Rolled", talismanTexts("Rolled")),
  ],
  properties: [
    property("AmmoCapacity", "SW.Item.Talisman.AmmoCapacity", effectLevels("AmmoCapacity")),
    property("PotionCooldown", "SW.Item.Talisman.PotionCooldown", effectLevels("PotionCooldown")),
    property("RangedBuff", "SW.Item.Talisman.RangedBuff", effectLevels("RangedBuff")),
    property("HealthyStrike", "SW.Item.Talisman.HealthyStrike", effectLevels("HealthyStrike")),
    property("Wolf", "SW.Item.Talisman.Wolf", grantedLevels("Wolf")),
    property("Llama", "sw.Item.Talisman.Llama", grantedLevels("Llama")),
    property("Rolled", "SW.Item.Talisman.Rolled", effectLevels("Rolled")),
  ],
  templates: [
    ...templates("AmmoCapacity", "SW.Effect.AmmoCapacity", [1.2, 1.4, 1.6]),
    ...templates("PotionCooldown", "SW.Effect.PotionCooldown", [-0.1, -0.15, -0.25], { EffectMinValue: -0.04, EffectMaxValue: -0.01 }),
    ...templates("RangedBuff", "SW.Effect.Power", [0.1, 0.15, 0.25], { EffectMinValue: 0, EffectMaxValue: 0.5 }),
    ...templates("HealthyStrike", "SW.Effect.HealthyStrike", [1, 2, 3]),
    // A template that rolls between its min and max instead of a fixed value: the site cannot print one number for it.
    ...templates("Rolled", "SW.Effect.AmmoCapacity", [1.2, 1.4, 1.6], { HasFixedEffectValue: false }),
  ],
  collections: [
    { Name: "SecretTalismans", CollectionDefinition: { ItemsInCollection: tags("SW.Item.Talisman.PotionCooldown", "SW.Item.Talisman.RangedBuff") } },
    { Name: "OtherCollection", CollectionDefinition: { ItemsInCollection: tags("SW.Item.Talisman.AmmoCapacity") } },
  ],
};

const magnitude = (multiplier: number, offset: number) => ({
  DynamicDataGetterFunction: tag("SW.TextEntry.DataGetter.GetEffectMagnitude"),
  ValuesToGet: [{ FormattingData: { IsPercentage: true, Multiplier: multiplier, Offset: offset, MaxFractionalDigits: 2 } }],
});
const effect = (name: string, description: object) => ({
  Name: name,
  TypeTag: tag(`SW.Effect.${name}`),
  TypeTextData: {
    Texts: {
      '(TagName="SW.TextEntry.Name")': { Text: `LOCTABLE("DT_EffectDefinition.csv", "SW_Effect_${name}_SW_TextEntry_Name")` },
      '(TagName="SW.TextEntry.Description")': {
        Text: `LOCTABLE("DT_EffectDefinition.csv", "SW_Effect_${name}_SW_TextEntry_Description")`,
        ...description,
      },
    },
  },
});

export const TALISMAN_EFFECTS: GameTables["effects"] = [
  effect("AmmoCapacity", magnitude(1, -1)),
  effect("PotionCooldown", magnitude(-1, 0)),
  effect("Power", magnitude(1, 0)),
  effect("HealthyStrike", {
    DynamicDataGetterFunction: tag("SW.TextEntry.DataGetter.GetHealthyStrikeValues"),
    ValuesToGet: [{ FormattingData: { IsPercentage: true, Multiplier: 1, Offset: 0, MaxFractionalDigits: 2 } }],
  }),
];

const SLOT = '<span class="placeholder" data-slot="0">{value}</span>';

export const talismanEntry = (slug: string, id: string, description?: { readonly en: string; readonly zh?: string }): Entry => ({
  id,
  slug,
  category: "talisman",
  variant: "normal",
  release: "base",
  name: loc({ zh: id, en: id }),
  ...(description ? { description: loc(description) } : {}),
  links: {},
});

export const effectEntry = (slug: string, id: string, description: Localized, untranslated?: Entry["untranslated"]): Entry => ({
  id,
  slug,
  category: "effect",
  variant: "normal",
  release: "base",
  name: loc({ zh: id, en: id }),
  description,
  ...(untranslated ? { untranslated } : {}),
  links: {},
});

export const QUIVER_TEXT = loc({ zh: `可多攜帶 ${SLOT} 支箭矢。`, en: `Carry ${SLOT} more ammo.` });

export const TALISMAN_ENTRIES: readonly Entry[] = [
  talismanEntry("ammo-capacity", "Talisman_AmmoCapacity"),
  talismanEntry("potion-cooldown", "Talisman_PotionCooldown"),
  talismanEntry("ranged-buff", "Talisman_RangedBuff"),
  talismanEntry("healthy-strike", "Talisman_HealthyStrike", { en: `Grants a ${SLOT} damage increase.` }),
  talismanEntry("wolf", "Talisman_Wolf", { en: "Summons a furry friend to fight by your side!" }),
  talismanEntry("llama", "Talisman_Llama", { en: "Summons a woolly wanderer to watch over you in battle!" }),
  talismanEntry("rolled", "Talisman_Rolled"),
  effectEntry("ammo-capacity", "AmmoCapacity", QUIVER_TEXT, ["ja"]),
  effectEntry("potion-cooldown", "PotionCooldown", loc({ en: `Reduces potion cooldown time by ${SLOT}.` })),
  effectEntry("power", "Power", loc({ en: `Ranged attacks deal ${SLOT} more damage.` })),
  effectEntry("healthy-strike", "HealthyStrike", loc({ en: `Grants a ${SLOT} damage increase.` })),
];
