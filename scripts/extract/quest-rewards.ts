/**
 * Quest rewards: each RewardData loot entry joins DT_LootSourceDefinition_Quest by tag. Item rows take their items from
 * loot-sources.json (the same guaranteed drops the item pages list); the area-drop row gives random items from the
 * named area; the quest size picks the emerald bundle.
 */
import { issue, type Issue } from "./issues";
import { slotsOf } from "./loot-slots";
import type { LootRow } from "./loot-tables";
import type { AreaNamer } from "./mob-areas";
import type { ItemSourcesData } from "./mob-schema";
import { tagKey } from "./mob-tags";
import type { Emeralds, QuestRarity, QuestReward, RawLootEntry, RawQuest } from "./quest-schema";

export interface SourceItems {
  readonly items: readonly string[];
  readonly picks?: { readonly count: number; readonly of: number };
}

export interface RewardContext {
  /** Quest loot rows by tagKey of their TypeTag. */
  readonly rowsByTag: ReadonlyMap<string, LootRow>;
  /** loot-sources.json source id → the items it gives. */
  readonly items: ReadonlyMap<string, SourceItems>;
  readonly namer: AreaNamer;
}

const AREA_DROP = "sw.quest.loot.areadropmodifier";
const RARITY = /^sw\.raritychance\.quest\.(common|rare|special|unique)$/;
const AREA = /^sw\.area(?:\.|$)/;
const RARITY_BY_WORD: Readonly<Record<string, QuestRarity>> = { common: "common", rare: "rare", special: "special", unique: "unique" };

export const questSourceId = (rowName: string): string => `quest:${rowName}`;

/** loot-sources.json inverted: each quest source with its item keys (sorted, as the file keys them) and its picks. */
export function itemsBySource(data: ItemSourcesData): ReadonlyMap<string, SourceItems> {
  const result = new Map<string, SourceItems>();
  for (const [key, sources] of Object.entries(data.items)) {
    for (const quest of sources.quests) {
      const known = result.get(quest.id);
      const picks = known?.picks ?? quest.picks;
      result.set(quest.id, { items: [...(known?.items ?? []), key], ...(picks ? { picks } : {}) });
    }
  }
  return result;
}

export const rowsByTag = (rows: readonly LootRow[]): ReadonlyMap<string, LootRow> => {
  const result = new Map<string, LootRow>();
  for (const row of rows) if (!result.has(tagKey(row.TypeTag.TagName))) result.set(tagKey(row.TypeTag.TagName), row);
  return result;
};

const tagsOf = (entry: RawLootEntry): string[] => entry.lootTags.gameplayTags.map((tag) => tag.tagName);

function rarityOf(tags: readonly string[]): QuestRarity | undefined {
  const word = tags.map((tag) => RARITY.exec(tagKey(tag))?.[1]).find((found) => found !== undefined);
  return word === undefined ? undefined : RARITY_BY_WORD[word];
}

/** The quest loot rows an entry names, in tag order. */
const entryRows = (entry: RawLootEntry, rows: ReadonlyMap<string, LootRow>): LootRow[] => tagsOf(entry).flatMap((tag) => rows.get(tagKey(tag)) ?? []);

/** Every quest loot row a quest's rewards name (first-completion and repeat lists), each once. */
export const rewardRowNames = (quest: RawQuest, rows: ReadonlyMap<string, LootRow>): string[] => [
  ...new Set(
    [...quest.RewardData.firstCompletionLootSourceData, ...quest.RewardData.lootSourceData].flatMap((entry) => entryRows(entry, rows).map((row) => row.Name)),
  ),
];

interface Built {
  readonly rewards: QuestReward[];
  readonly issues: Issue[];
}

function areaDrop(row: LootRow, tags: readonly string[], ctx: RewardContext, where: string): Built {
  const areaTag = tags.find((tag) => AREA.test(tagKey(tag)));
  const name = areaTag === undefined ? undefined : ctx.namer(areaTag);
  if (!name) return { rewards: [], issues: [issue("quest-area-unnamed", `${where}: ${areaTag ?? "(no area tag)"}`)] };
  const count = slotsOf(row).get("item")?.NumberOfGuaranteedDrops ?? 0;
  if (count < 1) return { rewards: [], issues: [issue("quest-reward-empty", `${where}: ${row.Name}`)] };
  const rarity = rarityOf(tags);
  return { rewards: [{ kind: "areaDrop", area: { name }, count, ...(rarity ? { rarity } : {}) }], issues: [] };
}

function rowReward(row: LootRow, tags: readonly string[], ctx: RewardContext, where: string): Built {
  if (tagKey(row.TypeTag.TagName) === AREA_DROP) return areaDrop(row, tags, ctx, where);
  const source = questSourceId(row.Name);
  const found = ctx.items.get(source);
  if (!found) return { rewards: [], issues: [issue("quest-reward-empty", `${where}: ${row.Name}`)] };
  const rarity = rarityOf(tags);
  return {
    rewards: [{ kind: "items", source, items: [...found.items], ...(found.picks ? { picks: { ...found.picks } } : {}), ...(rarity ? { rarity } : {}) }],
    issues: [],
  };
}

/** One reward per quest loot row an entry names; an entry naming none is reported. */
function entryRewards(entry: RawLootEntry, ctx: RewardContext, where: string): Built {
  const tags = tagsOf(entry);
  const rows = entryRows(entry, ctx.rowsByTag);
  if (rows.length === 0) return { rewards: [], issues: [issue("quest-reward-unmatched", `${where}: ${tags.join(", ") || "(no tags)"}`)] };
  const built = rows.map((row) => rowReward(row, tags, ctx, where));
  return { rewards: built.flatMap((one) => one.rewards), issues: built.flatMap((one) => one.issues) };
}

/** A reward list in data order; the same reward twice in one list is shown once. */
export function rewardsOf(entries: readonly RawLootEntry[], ctx: RewardContext, where: string): Built {
  const built = entries.map((entry) => entryRewards(entry, ctx, where));
  const all = built.flatMap((one) => one.rewards);
  const unique = all.filter((reward, index) => all.findIndex((other) => JSON.stringify(other) === JSON.stringify(reward)) === index);
  return { rewards: unique, issues: built.flatMap((one) => one.issues) };
}

/** The emerald bundle of a quest size (its QuestSize row's emerald slot); null when the size has no such row. */
export function emeraldsOf(sizeTag: string, rows: ReadonlyMap<string, LootRow>): Emeralds | null {
  const row = rows.get(tagKey(sizeTag));
  const slot = row ? slotsOf(row).get("emeralds") : undefined;
  return slot ? { guaranteed: slot.NumberOfGuaranteedDrops, rolls: slot.NumberOfRandomRolls, chancePerRoll: slot.DropChancePerRoll } : null;
}
