/** Hand-made guide DataTable rows in the game's export shape, with the real 1.1.2.0 values. */
import { GuideTablesSchema, type GuideTables } from "../../scripts/extract/guides-tables";

const tag = (TagName: string) => ({ TagName });
const keyValue = (name: string, value: number, type: "Int" | "Float" = "Int") =>
  type === "Int" ? { TypeTag: tag(`SW.KeyValue.${name}`), Type: "Int", Int: value } : { TypeTag: tag(`SW.KeyValue.${name}`), Type: "Float", Float: value };
const mapKey = (name: string) => `(TagName="${name}")`;
const loc = (file: string, key: string) => ({ Text: `LOCTABLE("${file}", "${key}")` });
const texts = (entries: Record<string, { Text: string }>) => ({ Texts: Object.fromEntries(Object.entries(entries).map(([entry, text]) => [mapKey(entry), text])) });

const enchantCost = (points: number, perLevel: number) => ({
  SpringStoneCost: 1, SpringStoneAdditionalCostPerLevel: 0, EnchantmentPointCost: points, EnchantmentPointAdditionalCostPerLevel: perLevel,
});

export const playerRow = () => ({
  Name: "DefaultPlayer",
  AttributeValues: [
    { Attribute: tag("SW.Attribute.HealthMax"), Value: 100 },
    { Attribute: tag("SW.Attribute.EmeraldsMax"), Value: 99999 },
    { Attribute: tag("SW.Attribute.SpringStoneMax"), Value: 100 },
    { Attribute: tag("SW.Attribute.LevelMax"), Value: 100 },
  ],
  Abilities: [
    { Ability: "/Script/InventorySystem.GA_RerollItemEffect", InstanceData: [{ RerollCost: 1 }] },
    {
      Ability: "/Script/InventorySystem.GA_ItemEnchant",
      InstanceData: [{
        InstancedStructScriptStruct: "/Script/InventorySystem.EnchantCost",
        EnchantCostMap: {
          [mapKey("SW.Rarity.Common")]: enchantCost(1, 1),
          [mapKey("SW.Rarity.Rare")]: enchantCost(1, 2),
          [mapKey("SW.Rarity.Special")]: enchantCost(2, 2),
          [mapKey("SW.Rarity.Unique")]: enchantCost(3, 2),
        },
      }],
    },
    {
      Ability: "/Script/InventorySystem.GA_UpgradeMerchant",
      InstanceData: [{
        InstancedStructScriptStruct: "/Script/InventorySystem.VendorUpgradeDefinition",
        UpgradeCosts: {
          [mapKey("SW.NPC.VillageMerchant")]: { LevelToCostMap: { "2": 10, "3": 15 } },
          [mapKey("SW.NPC.OldBlacksmith")]: { LevelToCostMap: { "2": 20, "3": 40 } },
          [mapKey("SW.NPC.Enchantsmith")]: { LevelToCostMap: { "2": 30, "3": 60 } },
        },
      }],
    },
  ],
});

const GEAR = ["MeleeWeapon", "RangedWeapon", "Helmet", "Chest", "Leggings", "Boots", "Artifact"];
export const merchantRow = () => ({
  Name: "VillageMerchant",
  TypeTag: tag("SW.NPC.VillageMerchant"),
  KeyValues: [
    ...GEAR.map((gear) => keyValue(`BaseCost.${gear}`, 20)),
    keyValue("DiscountMax", 0.2, "Float"),
    keyValue("RareCostMultiplier", 2, "Float"),
    keyValue("SpecialCostMultiplier", 3, "Float"),
    keyValue("UniqueCostMultiplier", 4, "Float"),
    keyValue("RefreshCost", 3),
    keyValue("SlotsPerRarity", 3),
  ],
});

const rarityRow = (name: string, rerollable: number, offset: number, storm: boolean) => ({
  Name: name,
  TypeTag: tag(`SW.Rarity.${name}`),
  RarityDefinition: {
    NumberOfEffectsData: {
      BaseNumberOfRerollableEffects: rerollable,
      ...(storm ? { AdditionalEffectChances: { [mapKey("SW.Item.Property.StorminatorReward")]: 1 } } : {}),
    },
    RarityWeight: 1,
    ItemPowerGenerationOffset: offset,
  },
});
export const rarityRows = () => [
  { Name: "BaseRarity", TypeTag: tag("SW.Rarity.Base"), RarityDefinition: { NumberOfEffectsData: { BaseNumberOfRerollableEffects: 0 }, ItemPowerGenerationOffset: 0 } },
  rarityRow("Common", 0, -2, false), rarityRow("Rare", 1, -2, true), rarityRow("Special", 2, -1, true), rarityRow("Unique", 1, 0, true),
];

const weight = (rarity: string, Weight: number, Operation = "Set") => ({ TypeTag: tag(`SW.Rarity.${rarity}`), Weight, Operation });
export const rarityChanceRows = () => [
  { Name: "Default", TypeTag: tag("SW.RarityChanceDefinition.Default"), TagList: { Tags: [weight("Common", 50), weight("Rare", 25), weight("Special", 20), weight("Unique", 5)] } },
  { Name: "Player", TypeTag: tag("SW.Player"), TagList: {} },
  { Name: "Boss", TypeTag: tag("SW.Trait.Boss"), TagList: { Tags: [weight("Common", 0, "Multiply"), weight("Rare", 30), weight("Special", 20), weight("Unique", 10)] } },
];

const progression = (Name: string, TagName: string, PlayerLevel: number) => ({ Name, TypeTag: tag(TagName), ProgressionData: { PlayerLevel, AdditionalGearItems: 0 } });
export const progressionRows = () => [
  progression("NoProgression", "SW.Progression.None", 1),
  progression("Town", "SW.Progression.Town.FirstVisit", 1),
  progression("PlainsStart", "SW.Progression.Plains.A1.Start", 2),
  progression("ForestA1Outpost", "SW.Progression.Forest.A1.Outpost", 9),
  progression("Maw", "SW.Progression.Maw", 16),
  progression("DesertStart", "SW.Progression.Desert.A1.Start", 26),
];

const AREA_CSV = "DT_AreaDefinition.csv";
const area = (Name: string, TagName: string, key?: string) => ({
  Name, TypeTag: tag(TagName), ...(key ? { TypeTextData: texts({ "SW.TextEntry.Name": loc(AREA_CSV, key) }) } : {}),
});
export const areaRows = () => [
  area("Town", "SW.Area.Town", "SW_Area_Town_SW_TextEntry_Name"),
  area("Plains_A1", "SW.Area.Plains.A1", "SW_Area_Plains_A1_SW_TextEntry_Name"),
  area("Desert_A1", "SW.Area.Desert.A1"),
];

export const SECRET_TAGS = ["DoubleDrop", "RangedBuff"] as const;
const COLLECTION_CSV = "DT_ItemCollectionsDefinition.csv";
const collectionKey = (entry: string) => `SW_Collectibles_SecretTalismans_SW_TextEntry_${entry}`;
export const collectionRows = () => [{
  Name: "SecretTalismans",
  TypeTag: tag("SW.Collectibles.SecretTalismans"),
  CollectionDefinition: { ItemsInCollection: { GameplayTags: [...SECRET_TAGS, "Missing"].map((name) => tag(`SW.Item.Talisman.${name}`)) } },
  TypeTextData: texts({
    "SW.TextEntry.Name": loc(COLLECTION_CSV, collectionKey("Name")),
    "SW.TextEntry.Description.Completion": loc(COLLECTION_CSV, collectionKey("Description_Completion")),
    "SW.TextEntry.Description.Completion.Short": loc(COLLECTION_CSV, collectionKey("Description_Completion_Short")),
  }),
}];

const TALISMAN_CSV = "DT_ItemDefinitionTalisman.csv";
export const talismanRows = () => SECRET_TAGS.map((name) => ({
  Name: `${name}Talisman`,
  TypeTag: tag(`SW.Item.Talisman.${name}`),
  TypeTextData: texts({ "SW.TextEntry.Name": loc(TALISMAN_CSV, `SW_Item_Talisman_${name}_SW_TextEntry_Name`) }),
}));

const slotWith = (itemTag: string, guaranteed = 1) => ({
  NumberOfGuaranteedDrops: guaranteed, NumberOfRandomRolls: 0, DropChancePerRoll: 0, InheritParentDropTable: true,
  DropTable: { Tags: [{ TypeTag: tag(itemTag), Weight: 1, Operation: "Set" }] },
});
const lootRow = (Name: string, TagName: string, slot: ReturnType<typeof slotWith>) => ({
  Name, TypeTag: tag(TagName), LootDropDefinition: { LootSlots: { [mapKey("SW.LootSlot.Talismans")]: slot } },
});
export const lootActorRows = () => [
  lootRow("TalismansChest_DoubleDrop", "SW.LootActor.TalismansChest.DoubleDrop", slotWith("SW.Item.Talisman.DoubleDrop")),
  lootRow("TalismansChest_RangedBuff", "SW.LootActor.TalismansChest.RangedBuff", slotWith("SW.Item.Talisman.RangedBuff")),
  lootRow("WoodenChest", "SW.LootActor.WoodenChest", slotWith("SW.Item.Talisman.DoubleDrop", 0)),
];
export const questLootRows = () => [
  lootRow("QuestTalismanRangedBoost", "SW.Quest.Loot.Talisman.RangedBoost", slotWith("SW.Item.Talisman.RangedBuff")),
  lootRow("QuestTalismanDoubleDrop", "SW.Quest.Loot.Talisman.DoubleDrop", slotWith("SW.Item.Talisman.DoubleDrop")),
];

const quest = (id: string, loot: string[]) => ({
  id,
  RewardData: { firstCompletionLootSourceData: [], lootSourceData: loot.map((name) => ({ lootTags: { gameplayTags: [{ tagName: name }] } })) },
});
/** RangedBoost is handed out by two quests; the DoubleDrop quest loot row exists but no quest uses it. */
export const questLibraryRows = () => [
  { Name: "Core_Quests", RawQuestData: JSON.stringify({ Name: "Core_Quests", Quests: [quest("CA04_BR", ["SW.Quest.Loot.Talisman.RangedBoost"]), quest("CA05_BR", ["SW.Quest.Loot.Talisman.RangedBoost", "SW.Quest.Loot.AreaDropModifier"])] }) },
  { Name: "Empty_Quests" },
];

export const enchantmentRows = () => ["SW.Enchantment.Burning", "SW.Enchantment.Burning.I", "SW.Enchantment.Burning.II", "SW.Enchantment.Burning.III"].map((TagName) => ({ Name: TagName, TypeTag: tag(TagName) }));

export const REAL_GUIDE_ROWS = () => ({
  player: [playerRow()],
  npcs: [merchantRow()],
  rarity: rarityRows(),
  rarityChance: rarityChanceRows(),
  progression: progressionRows(),
  areas: areaRows(),
  collections: collectionRows(),
  talismans: talismanRows(),
  lootActor: lootActorRows(),
  questLoot: questLootRows(),
  quests: questLibraryRows(),
  enchantments: enchantmentRows(),
});

export const guideTables = (overrides: Partial<Record<keyof GuideTables, unknown[]>> = {}): GuideTables =>
  GuideTablesSchema.parse({ ...REAL_GUIDE_ROWS(), ...overrides });
