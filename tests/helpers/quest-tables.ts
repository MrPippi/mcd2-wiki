/** Small quest-library and quest-loot rows shaped like the game's, for the quest extractor tests. */
import type { LootRow } from "../../scripts/extract/loot-tables";
import type { RawGoal, RawQuest } from "../../scripts/extract/quest-schema";

type RawLoot = RawQuest["RewardData"]["lootSourceData"];

/** A loot entry naming these gameplay tags. */
export const lootEntry = (...tags: string[]): RawLoot[number] => ({ lootSourceTag: { tagName: "None" }, lootTags: { gameplayTags: tags.map((tagName) => ({ tagName })) } });

export interface QuestFixture {
  readonly id: string;
  readonly type?: "CoreQuest" | "SideQuest";
  readonly state?: string;
  readonly prerequisites?: readonly string[];
  readonly size?: string;
  readonly area?: string;
  readonly first?: RawLoot;
  readonly every?: RawLoot;
  readonly goals?: RawGoal;
  readonly replayable?: boolean;
}

export function rawQuest(fixture: QuestFixture): RawQuest {
  return {
    id: fixture.id,
    id_tag: `SW.Quest.Id.${fixture.id}`,
    initial_state: fixture.state ?? "Locked",
    quest_type: fixture.type ?? "SideQuest",
    is_replayable: fixture.replayable ?? false,
    prerequisites: [...(fixture.prerequisites ?? [])],
    RewardData: {
      questSize: { tagName: fixture.size ?? "SW.QuestSize.Small" },
      areaRewardScalingTag: { tagName: fixture.area ?? "SW.Area.Forest.A1" },
      firstCompletionLootSourceData: [...(fixture.first ?? [])],
      lootSourceData: [...(fixture.every ?? [])],
    },
    ...(fixture.goals ? { goals: fixture.goals } : {}),
  };
}

/** A library row the way DT_QuestLibraries stores it: the quests as a JSON string. */
export const libraryRow = (name: string, quests: readonly RawQuest[]): { Name: string; RawQuestData: string } => ({
  Name: name,
  RawQuestData: JSON.stringify({ Name: name, DefaultQuestData: {}, Quests: quests }),
});

interface SlotFixture {
  readonly slot: string;
  readonly guaranteed: number;
  readonly rolls?: number;
  readonly chance?: number;
  readonly items?: readonly string[];
}

export function lootRow(name: string, tag: string, slots: readonly SlotFixture[] = []): LootRow {
  return {
    Name: name,
    TypeTag: { TagName: tag },
    LootDropDefinition: {
      LootSlots: Object.fromEntries(slots.map((slot) => [
        `(TagName="SW.LootSlot.${slot.slot}")`,
        {
          NumberOfGuaranteedDrops: slot.guaranteed,
          NumberOfRandomRolls: slot.rolls ?? 0,
          DropChancePerRoll: slot.chance ?? 1,
          InheritParentDropTable: false,
          DropTable: { Tags: (slot.items ?? []).map((item) => ({ TypeTag: { TagName: item }, Weight: 1, Operation: "Set" })) },
        },
      ])),
    },
  };
}

/** The four quest-size rows with the game's emerald numbers, plus the area-drop row. */
export const SIZE_ROWS: readonly LootRow[] = [
  lootRow("QuestSizeSmall", "SW.QuestSize.Small", [{ slot: "Emeralds", guaranteed: 5, rolls: 5, chance: 0.25 }]),
  lootRow("QuestSizeMedium", "SW.QuestSize.Medium", [{ slot: "Emeralds", guaranteed: 8, rolls: 8, chance: 0.25 }]),
  lootRow("QuestAreaLootDropModifier", "SW.Quest.Loot.AreaDropModifier", [{ slot: "Item", guaranteed: 1 }]),
];

export const task = (name: string, extra: Partial<RawGoal> = {}): RawGoal => ({ name, ...extra });
export const group = (name: string, subgoals: readonly RawGoal[], extra: Partial<RawGoal> = {}): RawGoal => ({ name, type: "Sequence", subgoals, ...extra });
