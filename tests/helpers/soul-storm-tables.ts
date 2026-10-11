/** Hand-made Soul Storm DataTable rows in the game's export shape, with the real values from spec §2. */
import { lootRow, slot } from "./mob-tables";
import { SoulStormTablesSchema, type SoulStormTables } from "../../scripts/extract/soul-storm-tables";

const tag = (TagName: string) => ({ TagName });
const tagWeight = (name: string, Weight = 1, Operation = "Set") => ({ TypeTag: tag(name), Weight, Operation });
const keyValue = (name: string, type: "Int" | "Float", value: number) =>
  type === "Int" ? { TypeTag: tag(`SW.KeyValue.${name}`), Type: "Int", Int: value } : { TypeTag: tag(`SW.KeyValue.${name}`), Type: "Float", Float: value };
const attr = (name: string, Value: number) => ({ Attribute: tag(`SW.Attribute.${name}`), Value });

export const ROTATION_TAGS = [
  "SW.Area.Forest.A1", "SW.Area.Meadow.A1", "SW.Area.Plains.A2", "SW.Area.Carapace.A1",
  "SW.Area.Meadow.A2", "SW.Area.Desert.A1", "SW.Area.Plains.A1",
] as const;

export const scheduleRow = (Timestamp = "2026.01.01-00.00.00", DurationInSeconds = 1200, CadenceInSeconds = 2400) => ({
  Name: "SoulStormTime", TypeTag: tag("OnlineDataTables.TypeSystem.DT_SoulStormTimeSchedule"), Timestamp, DurationInSeconds, CadenceInSeconds,
});

export const rotationRow = (areas: readonly string[] = ROTATION_TAGS) => ({
  Name: "1", TypeTag: tag("OnlineDataTables.SoulStormScheduleAreaRotation"), AreaTags: areas.map(tag),
});

export const BASE_TAG = "SW.PropActor.SoulStorm.Storminator.Base";
const FINAL = "SW.AbilityCallsign.Soulstorm.StorminatorHealthFinalThreshold";
const SHIELD = "SW.AbilityCallsign.Soulstorm.SpawnShield";
const scaling = { TagMap: { '(AttributeName="HealthMax",Attribute=/Script/SpicewoodGAS.ATR_Health:HealthMax,AttributeOwner=None)': { Multipliers: [1, 1.5, 2, 2.5] } } };

export const baseGenerator = () => ({
  Name: "Storminator",
  TypeTag: tag(BASE_TAG),
  Traits: { GameplayTags: [tag("SW.PropActor.Default.HostileMob")] },
  AttributeValues: [attr("Health", 800), attr("Resistance.KnockbackResistanceMultiplier", 0), attr("SoulDamageResistanceMultiplier", 0.5), attr("MeleeDamageResistanceMultiplier", 0.8)],
  Abilities: [
    { AbilityCallsign: tag(SHIELD), CommonKeyValues: [keyValue("ActivationChance", "Int", 0), keyValue("CooldownDuration", "Float", 0)], InstanceData: [{ TagToSpawn: tag("SW.PropActor.SoulStorm.Barrier") }] },
    { AbilityCallsign: tag("SW.AbilityCallsign.ApplyDeathEffects"), CommonKeyValues: [keyValue("ActivationChance", "Int", 100)], InstanceData: [{ TagToSpawn: tag("SW.LootActor.StorminatorChest.Easy") }] },
  ],
  TypeTextData: { Texts: { '(TagName="SW.TextEntry.Name")': { Text: 'LOCTABLE("DT_SoulStormPropActorDefinition.csv", "SW_PropActor_SoulStorm_Storminator_Base_SW_TextEntry_Name")' } } },
});

export interface TierOptions {
  readonly health?: number;                       // undefined → the row has no Health (Easy)
  readonly finalThreshold: number;
  readonly finalWave: string;                     // SW.SpawnDefinition.Storminator.Wave.<…>
  readonly shield?: readonly [chancePercent: number, cooldownSeconds: number];
}
export const tierGenerator = (tier: "Easy" | "Medium" | "Hard", options: TierOptions) => ({
  Name: `Storminator_${tier}`,
  TypeTag: tag(`SW.PropActor.SoulStorm.Storminator.${tier}`),
  Traits: { GameplayTags: [tag(BASE_TAG), tag("SW.Property.Spawnable")] },
  ...(options.health === undefined ? {} : { AttributeValues: [attr("Health", options.health)] }),
  AttributeThresholds: { Thresholds: [{ Event: tag("SW.GameplayEvent.SoulStorm.Health.FinalThreshold"), Value: options.finalThreshold }] },
  Abilities: [{ AbilityCallsign: tag(FINAL), InstanceData: [{ WaveArray: [{ SpawnDefinition: tag(options.finalWave) }] }] }],
  AbilitySpecialization: {
    Specializations: options.shield
      ? [{ AbilityCallsign: tag(SHIELD), KeyValueSpecializations: [{ KeyValue: keyValue("ActivationChance", "Int", options.shield[0]) }, { KeyValue: keyValue("CooldownDuration", "Float", options.shield[1]) }] }]
      : [],
  },
  MultiplayerScalingDefinitions: scaling,
});

export const shieldGenerator = () => ({ Name: "Shieldinator", TypeTag: tag("SW.PropActor.SoulStorm.Barrier"), AttributeValues: [attr("Health", 55)] });

export const REAL_GENERATORS = () => [
  baseGenerator(),
  shieldGenerator(),
  tierGenerator("Easy", { finalThreshold: 0.2, finalWave: "SW.SpawnDefinition.Storminator.Wave.SoulstatedUndead" }),
  tierGenerator("Medium", { health: 1000, finalThreshold: 0.4, finalWave: "SW.SpawnDefinition.Storminator.Wave.Type2", shield: [16, 60] }),
  tierGenerator("Hard", { health: 1200, finalThreshold: 0.4, finalWave: "SW.SpawnDefinition.Storminator.Wave.Type3", shield: [40, 45] }),
];

const slotKey = '(TagName="SW.SpawnSlot.Mob.Special")';
export const spawnRow = (Name: string, typeTag: string, tags: readonly (readonly [string, number])[]) => ({
  Name, TypeTag: tag(typeTag), SpawnDefinition: { SpawnSlot: { [slotKey]: { SpawnTable: { Tags: tags.map(([name, weight]) => tagWeight(name, weight)) } } } },
});
export const REAL_SPAWNS = () => [
  {
    Name: "StorminatorEasy", TypeTag: tag("SW.SpawnDefinition.Storminator"),
    SpawnDefinition: { SpawnSlot: { '(TagName="SW.SpawnSlot.Storminator")': { SpawnTable: {}, Conditions: [{ DropTable: { Tags: [
      tagWeight("SW.PropActor.SoulStorm.Storminator.Easy", 2), tagWeight("SW.PropActor.SoulStorm.Storminator.Medium", 2), tagWeight("SW.PropActor.SoulStorm.Storminator.Hard", 1),
    ] } }] } } },
  },
  spawnRow("StorminatorWaveSoulstated", "SW.SpawnDefinition.Storminator.Wave.SoulstatedUndead", [["SW.Mob.Zombie.SoulStated", 1], ["SW.Mob.Vindicator.SoulStated", 1]]),
  spawnRow("Type2", "SW.SpawnDefinition.Storminator.Wave.Type2", ["Witch", "Enderman", "Warden", "Evoker", "WellspringMiniboss", "Driftweaver"].map((mob) => [`SW.Mob.${mob}`, 1] as const)),
  spawnRow("Type3", "SW.SpawnDefinition.Storminator.Wave.Type3", [["SW.SpawnDefinition.Storminator.Wave.CopperMonstrosity", 1], ["SW.SpawnDefinition.Storminator.Wave.RedStoneMonstrosity", 1], ["SW.SpawnDefinition.Storminator.Wave.SculkMonstrosity", 1]]),
  spawnRow("CopperMonstrosity", "SW.SpawnDefinition.Storminator.Wave.CopperMonstrosity", [["SW.Mob.Monstrosity.Copper.Storm", 1]]),
  spawnRow("RedStoneMonstrosity", "SW.SpawnDefinition.Storminator.Wave.RedStoneMonstrosity", [["SW.Mob.Monstrosity.RedStone.Storm", 1]]),
  spawnRow("SculkMonstrosity", "SW.SpawnDefinition.Storminator.Wave.SculkMonstrosity", [["SW.Mob.Monstrosity.Sculk.Storm", 1]]),
];

/** [name, tag, gear, springStone [g, rolls], emeralds [g, rolls]] for the six chests, as in the game. */
const CHESTS = [
  ["StorminatorChestEasy", "SW.LootActor.StorminatorChest.Easy", 1, [1, 2], [5, 10]],
  ["StorminatorChestMedium", "SW.LootActor.StorminatorChest.Medium", 1, [1, 2], [5, 10]],
  ["StorminatorChestHard", "SW.LootActor.StorminatorChest.Hard", 2, [1, 3], [5, 15]],
  ["SoulStormRewardChestLow", "SW.LootActor.StorminatorChest.Final.Low", 2, [1, 3], [5, 15]],
  ["SoulStormRewardChestMedium", "SW.LootActor.StorminatorChest.Final.Medium", 3, [1, 3], [5, 15]],
  ["SoulStormRewardChestHigh", "SW.LootActor.StorminatorChest.Final.High", 4, [4, 3], [10, 15]],
] as const;
export const REAL_CHESTS = () => [
  { Name: "StorminatorChest", TypeTag: tag("SW.LootActor.StorminatorChest"), LootDropDefinition: {} },
  ...CHESTS.map(([name, typeTag, gear, [stoneG, stoneR], [emeraldG, emeraldR]]) =>
    lootRow(name, typeTag, [
      slot("Item", gear, 0, 1, false),
      slot("SpringStone", stoneG, stoneR, 0.33, true, ["SW.Item.Currency.Springstone"]),
      slot("Emeralds", emeraldG, emeraldR, 0.3, false, ["SW.Item.Currency.Emerald", "SW.Item.Currency.EmeraldBlock"]),
    ])),
  lootRow("FancyChest", "SW.LootActor.FancyChest", [slot("Item", 1, 0, 1, true)]),
];

export const REAL_RARITY = () => [
  { Name: "Default", TypeTag: tag("SW.RarityChanceDefinition.Default"), TagList: { Tags: [tagWeight("SW.Rarity.Common", 50), tagWeight("SW.Rarity.Rare", 25)] } },
  { Name: "StorminatorRewardChest", TypeTag: tag("SW.LootActor.StorminatorChest"), TagList: { Tags: [tagWeight("SW.Rarity.Common", 0, "Multiply"), tagWeight("SW.Rarity.Rare", 0.01, "Multiply")] } },
];

export const REAL_BALANCE = () => [
  { Name: "Active", TypeTag: tag("SW.GameplayRuleSet.Active"), Traits: { GameplayTags: [tag("SW.GameplayRuleSet.SecondPass")] }, SoulStormConstants: { SoulStormEligibilityGamestate: tag("None") } },
  { Name: "SecondPass", TypeTag: tag("SW.GameplayRuleSet.SecondPass"), SoulStormConstants: { SoulStormEligibilityGamestate: tag("SW.GameState.MainQuestComplete"), SoulStormEndSpawnVolumeCooldownSeconds: 30 } },
];

const EMPTY = { schedule: [], rotation: [], props: [], spawns: [], lootActor: [], rarityChance: [], gameBalance: [] };
export const soulStormTables = (partial: Partial<Record<keyof SoulStormTables, readonly unknown[]>> = {}): SoulStormTables =>
  SoulStormTablesSchema.parse({ ...EMPTY, ...partial });
export const realSoulStormTables = (): SoulStormTables =>
  soulStormTables({ schedule: [scheduleRow()], rotation: [rotationRow()], props: REAL_GENERATORS(), spawns: REAL_SPAWNS(), lootActor: REAL_CHESTS(), rarityChance: REAL_RARITY(), gameBalance: REAL_BALANCE() });
