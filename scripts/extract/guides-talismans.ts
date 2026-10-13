/**
 * The secret talismans: the SecretTalismans collection (DT_ItemCollectionsDefinition), the loot chest that holds each one
 * (DT_LootSourceDefinition_LootActor TalismansChest rows) and the quests whose rewards name it. A quest counts only when
 * DT_QuestLibraries actually lists its loot tag; DT_LootSourceDefinition_Quest alone has rows no quest uses.
 */
import { z } from "zod";
import type { Entry } from "./schemas";
import { entryIndex, locId } from "./game-rows";
import type { GuidesData, SecretTalisman } from "./guides-schema";
import type { GuideTables } from "./guides-tables";
import { gameText, rowText, type Locales } from "./guides-texts";
import { issue, type Issue } from "./issues";
import type { LootRow } from "./loot-tables";

const COLLECTION = "SecretTalismans";
const CHEST_PREFIX = "sw.lootactor.talismanschest.";
const QUEST_NAMES = "Text/Release/QuestTrackerLabels.csv";
const TEXT_ENTRIES = {
  name: "SW.TextEntry.Name",
  completion: "SW.TextEntry.Description.Completion",
  door: "SW.TextEntry.Description.Completion.Short",
} as const;

const lower = (tag: string): string => tag.toLowerCase();

const LootTags = z.looseObject({ lootTags: z.looseObject({ gameplayTags: z.array(z.looseObject({ tagName: z.string() })) }) });
const QuestLibrary = z.looseObject({
  Quests: z.array(z.looseObject({
    id: z.string(),
    RewardData: z.looseObject({ firstCompletionLootSourceData: z.array(LootTags).optional(), lootSourceData: z.array(LootTags).optional() }).optional(),
  })).optional(),
});

interface QuestReward {
  readonly questId: string;
  readonly lootTag: string;
}

function parseLibrary(name: string, raw: string): { rewards: QuestReward[]; issues: Issue[] } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { rewards: [], issues: [issue("guides-value-missing", `DT_QuestLibraries ${name}: RawQuestData is not JSON`)] };
  }
  const parsed = QuestLibrary.safeParse(json);
  if (!parsed.success) return { rewards: [], issues: [issue("guides-value-missing", `DT_QuestLibraries ${name}: unexpected quest shape`)] };
  const rewards = (parsed.data.Quests ?? []).flatMap((quest) =>
    [...(quest.RewardData?.firstCompletionLootSourceData ?? []), ...(quest.RewardData?.lootSourceData ?? [])]
      .flatMap((source) => source.lootTags.gameplayTags)
      .map((tag) => ({ questId: quest.id, lootTag: lower(tag.tagName) })),
  );
  return { rewards, issues: [] };
}

/** Every quest loot tag the quest libraries hand out, with the quest that hands it out. */
export function questRewards(tables: GuideTables): { rewards: QuestReward[]; issues: Issue[] } {
  const parsed = tables.quests.flatMap((row) => (row.RawQuestData ? [parseLibrary(row.Name, row.RawQuestData)] : []));
  return { rewards: parsed.flatMap((one) => one.rewards), issues: parsed.flatMap((one) => one.issues) };
}

const dropTags = (row: LootRow): string[] =>
  Object.values(row.LootDropDefinition.LootSlots ?? {}).flatMap((slot) => (slot.DropTable.Tags ?? []).map((tag) => lower(tag.TypeTag.TagName)));

/** A chest holding exactly this item: a TalismansChest row with a guaranteed slot whose only drop is the item. */
const hasChest = (tables: GuideTables, itemTag: string): boolean =>
  tables.lootActor.some((row) => lower(row.TypeTag.TagName).startsWith(CHEST_PREFIX)
    && Object.values(row.LootDropDefinition.LootSlots ?? {}).some((slot) => slot.NumberOfGuaranteedDrops >= 1
      && (slot.DropTable.Tags ?? []).length === 1 && lower(slot.DropTable.Tags?.[0]?.TypeTag.TagName ?? "") === itemTag));

function questsFor(tables: GuideTables, locales: Locales, rewards: readonly QuestReward[], itemTag: string): { quests: SecretTalisman["quests"]; issues: Issue[] } {
  const lootTags = new Set(tables.questLoot.filter((row) => dropTags(row).includes(itemTag)).map((row) => lower(row.TypeTag.TagName)));
  const ids = [...new Set(rewards.filter((reward) => lootTags.has(reward.lootTag)).map((reward) => reward.questId))];
  const named = ids.map((id) => ({ id, name: gameText(locales, QUEST_NAMES, id).text ?? null }));
  return {
    quests: named,
    issues: named.filter((quest) => quest.name === null).map((quest) => issue("guides-quest-unnamed", `${quest.id} (${itemTag})`)),
  };
}

function talismanOf(input: SecretInput, rewards: readonly QuestReward[], tag: string): { talisman?: SecretTalisman; issues: Issue[] } {
  const itemTag = lower(tag);
  const row = input.tables.talismans.find((candidate) => lower(candidate.TypeTag.TagName) === itemTag);
  const entry = row ? entryIndex(input.entries)("talisman", locId(row.TypeTextData)) : undefined;
  if (!entry) return { issues: [issue("guides-talisman-unlinked", tag)] };
  const quests = questsFor(input.tables, input.locales, rewards, itemTag);
  return { talisman: { slug: entry.slug, chest: hasChest(input.tables, itemTag), quests: quests.quests }, issues: quests.issues };
}

export interface SecretInput {
  readonly tables: GuideTables;
  readonly locales: Locales;
  readonly entries: readonly Entry[];
}

export function buildSecretTalismans(input: SecretInput): { secretTalismans: GuidesData["secretTalismans"]; issues: Issue[] } {
  const collection = input.tables.collections.find((row) => row.Name === COLLECTION);
  if (!collection) {
    return { secretTalismans: { name: null, completion: null, door: null, talismans: [] }, issues: [issue("guides-value-missing", `DT_ItemCollectionsDefinition: ${COLLECTION}`)] };
  }
  const rewards = questRewards(input.tables);
  const built = (collection.CollectionDefinition?.ItemsInCollection?.GameplayTags ?? []).map((tag) => talismanOf(input, rewards.rewards, tag.TagName));
  const texts = (Object.keys(TEXT_ENTRIES) as (keyof typeof TEXT_ENTRIES)[]).map((key) => [key, rowText(input.locales, collection.TypeTextData, TEXT_ENTRIES[key])] as const);
  const text = (key: keyof typeof TEXT_ENTRIES) => texts.find(([id]) => id === key)?.[1].text ?? null;
  return {
    secretTalismans: {
      name: text("name"),
      completion: text("completion"),
      door: text("door"),
      talismans: built.flatMap((one) => (one.talisman ? [one.talisman] : [])),
    },
    issues: [...rewards.issues, ...built.flatMap((one) => one.issues), ...texts.flatMap(([, result]) => result.issues)],
  };
}
