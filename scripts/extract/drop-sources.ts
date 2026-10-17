/**
 * Which triggers the drop odds cover, and their profiles. Only triggers the site already shows are covered, and only where the
 * site's own data says they can happen (the tables do not place chests in areas):
 * - chests the item pages list (loot-sources.json), plus the procedural dungeon and rift versions that carry one of them as a
 *   trait; chests with a fixed pool have no area, chests that draw from their area's pool are paired with each area that has a
 *   drop pool and each enchantment book pool;
 * - every reward batch of a published quest: the entry's own tags together with the quest's reward area;
 * - bosses, minibosses and the Piggy Bank, with the counts the bestiary shows, over the pool of each area they are found in.
 * Mercenaries, regular mobs, merchants, Soul Storm chests and key chests are left out; the extract reports what it skips.
 */
import { issue, type Issue } from "./issues";
import { profileOfSpecs, profileOfTags, ITEM_SLOTS, type ProfileContext, type RawProfile } from "./drop-profile";
import type { LootRow, LootTables } from "./loot-tables";
import type { ItemSourcesData, MobData } from "./mob-schema";
import { tagKey } from "./mob-tags";
import type { LibraryQuest } from "./quest-tables";

export interface Planned {
  readonly id: string;
  readonly kind: "chest" | "quest" | "mob";
  /** A quest batch given on the first completion only. */
  readonly first?: boolean;
  /** Area source id ("" for none) and the trigger's profile there. */
  readonly contexts: readonly (readonly [string, RawProfile])[];
}

export interface PlanInput {
  readonly loot: LootTables;
  readonly sources: ItemSourcesData;
  readonly quests: readonly LibraryQuest[];
  /** Ids of the quests the site publishes. */
  readonly publishedQuests: ReadonlySet<string>;
  readonly mobs: MobData;
  /** Mob slug → the tags its rows go by. */
  readonly mobTags: ReadonlyMap<string, readonly string[]>;
}

interface Place {
  readonly id: string;
  readonly tag: string;
}

interface Planning {
  readonly planned: Planned[];
  readonly issues: Issue[];
}

const NONE_TAG = "None";
const ENCHANTED_BOOK = "enchantedbook";
const MOB_KINDS: ReadonlySet<string> = new Set(["boss", "miniboss"]);
const PIGGY_BANK = "PiggyBank";
const SUFFIX = (kind: string, id: string): string => `${kind}:${id}`;

const hasContent = (profile: RawProfile): boolean => profile.slots.length > 0;

/** Area and enchantment book pool places: the areas with a drop pool, and for each book pool the area that carries it. */
export function placesOf(input: PlanInput): { areas: Place[]; bookPools: Place[]; issues: Issue[] } {
  const named = Object.entries(input.sources.sources);
  const areas = named.filter(([, source]) => source.kind === "area").map(([id]): Place => ({ id, tag: id.replace(/^area:/, "") }));
  const books = named.filter(([, source]) => source.kind === "bookPool").map(([id]) => {
    const row = input.loot.generic.find((one) => one.Name === id.replace(/^bookPool:/, ""));
    const carrier = input.loot.area
      .filter((area) => row !== undefined && (area.Traits?.GameplayTags ?? []).some((trait) => tagKey(trait.TagName) === tagKey(row.TypeTag.TagName)))
      .map((area) => area.TypeTag.TagName)
      .sort((a, b) => a.split(".").length - b.split(".").length || a.localeCompare(b))[0];
    return { id, carrier };
  });
  return {
    areas,
    bookPools: books.flatMap((one) => (one.carrier ? [{ id: one.id, tag: one.carrier }] : [])),
    issues: books.filter((one) => !one.carrier).map((one) => issue("drop-ignored", `${one.id}: no area carries this book pool`)),
  };
}

const traitsOf = (row: LootRow): string[] => (row.Traits?.GameplayTags ?? []).map((trait) => tagKey(trait.TagName));

/** Chests: the site's, then the procedural rows that carry one of them. */
function planChests(input: PlanInput, context: ProfileContext, places: readonly Place[]): Planning {
  const siteIds = Object.entries(input.sources.sources).filter(([, source]) => source.kind === "chest").map(([id]) => id);
  const byName = new Map(input.loot.lootActor.map((row) => [row.Name, row] as const));
  const areaPool = (id: string): boolean => Object.values(input.sources.items).some((item) => item.chests.some((chest) => chest.id === id && chest.pool === "area"));
  const site = siteIds.flatMap((id) => {
    const row = byName.get(id.replace(/^chest:/, ""));
    return row ? [{ id, row, areas: areaPool(id) }] : [];
  });
  // A version of a listed chest: its tag extends the chest's (FancyChest.Procedural) and it carries the chest as a trait.
  const parentOf = (row: LootRow) => site.find((chest) => tagKey(row.TypeTag.TagName).startsWith(`${tagKey(chest.row.TypeTag.TagName)}.`) && traitsOf(row).includes(tagKey(chest.row.TypeTag.TagName)));
  const variants = input.loot.lootActor
    .filter((row) => !siteIds.includes(SUFFIX("chest", row.Name)) && parentOf(row) !== undefined)
    .map((row) => ({ id: SUFFIX("chest", row.Name), row, areas: parentOf(row)?.areas ?? false }));
  const planned = [...site, ...variants].map(({ id, row, areas }): Planned => {
    const where: readonly (readonly [string, readonly string[]])[] = areas ? places.map((place) => [place.id, [row.TypeTag.TagName, place.tag]] as const) : [["", [row.TypeTag.TagName]]];
    return { id, kind: "chest", contexts: where.map(([area, tags]) => [area, profileOfTags(context, tags)] as const).filter(([, profile]) => hasContent(profile)) };
  });
  return {
    planned: planned.filter((one) => one.contexts.length > 0),
    issues: [
      ...siteIds.filter((id) => !site.some((chest) => chest.id === id)).map((id) => issue("drop-ignored", `${id}: no loot actor row`)),
      ...planned.filter((one) => one.contexts.length === 0).map((one) => issue("drop-ignored", `${one.id}: no item it can give`)),
    ],
  };
}

const tagsOfEntry = (entry: LibraryQuest["quest"]["RewardData"]["lootSourceData"][number]): string[] => entry.lootTags.gameplayTags.map((tag) => tag.tagName);

/** Quest reward batches: first-completion entries, then the repeat ones; each is its own trigger. */
function planQuests(input: PlanInput, context: ProfileContext): Planning {
  const published = input.quests.filter(({ quest }) => input.publishedQuests.has(quest.id));
  const planned = published.flatMap(({ quest }) => {
    const { firstCompletionLootSourceData: first, lootSourceData: every, areaRewardScalingTag: area } = quest.RewardData;
    const areaTags = area.tagName === NONE_TAG ? [] : [area.tagName];
    return [...first, ...every].map((entry, index): Planned => ({
      id: `quest:${quest.id}:${index}`,
      kind: "quest",
      ...(index < first.length ? { first: true } : {}),
      contexts: [["", profileOfTags(context, [...tagsOfEntry(entry), ...areaTags])]],
    }));
  });
  const kept = planned.filter((one) => hasContent(one.contexts[0][1]));
  return {
    planned: kept,
    issues: [issue("drop-ignored", `${input.quests.length - published.length} unpublished quests have no drop odds`), ...(kept.length === planned.length ? [] : [issue("drop-ignored", `${planned.length - kept.length} quest reward batches give no item`)])],
  };
}

const lowerSlot = (slot: string): string => slot.toLowerCase();

/** Bosses, minibosses and the Piggy Bank: the bestiary's counts for the slots that draw from the area pool. */
function planMobs(input: PlanInput, context: ProfileContext, places: { areas: readonly Place[]; bookPools: readonly Place[] }): Planning {
  const mobs = input.mobs.mobs.filter((mob) => MOB_KINDS.has(mob.kind) || mob.id === PIGGY_BANK);
  const issues: Issue[] = [];
  const planned = mobs.flatMap((mob): Planned[] => {
    const drops = mob.drops.filter((drop) => ITEM_SLOTS.includes(lowerSlot(drop.slot)) && (drop.guaranteed > 0 || drop.rolls > 0));
    issues.push(...drops.filter((drop) => drop.pool === "own").map((drop) => issue("drop-ignored", `${mob.id}: ${drop.slot} draws from its own list, not covered`)));
    const specs = drops.filter((drop) => drop.pool === "area").map((drop) => ({ slot: lowerSlot(drop.slot), guaranteed: drop.guaranteed, rolls: drop.rolls, chance: drop.chancePerRoll }));
    const found = places.areas.filter((place) => mob.areas.some((area) => tagKey(area.areaId) === tagKey(place.tag)));
    // A mob with no known area can still give books, which depend on the book pool of the place.
    const books = specs.filter((spec) => spec.slot === ENCHANTED_BOOK);
    const where = found.length > 0 ? found.map((place) => ({ place, specs })) : books.length > 0 ? places.bookPools.map((place) => ({ place, specs: books })) : [];
    if (specs.length > 0 && where.length === 0) issues.push(issue("drop-ignored", `${mob.id}: found in no area with a drop pool`));
    const tags = input.mobTags.get(mob.slug) ?? [];
    const contexts = where.map(({ place, specs: used }) => [place.id, profileOfSpecs(context, used, place.tag, tags)] as const).filter(([, profile]) => hasContent(profile));
    return contexts.length > 0 ? [{ id: `mob:${mob.id}`, kind: "mob", contexts }] : [];
  });
  return { planned, issues };
}

/** Every trigger the drop odds cover, and what was left out. */
export function planSources(input: PlanInput, context: ProfileContext): Planning {
  const places = placesOf(input);
  // A book pool whose area is already listed would repeat that area.
  const extra = places.bookPools.filter((pool) => !places.areas.some((area) => tagKey(area.tag) === tagKey(pool.tag)));
  const chests = planChests(input, context, [...places.areas, ...extra]);
  const quests = planQuests(input, context);
  const mobs = planMobs(input, context, places);
  return { planned: [...chests.planned, ...mobs.planned, ...quests.planned], issues: [...places.issues, ...chests.issues, ...mobs.issues, ...quests.issues] };
}
