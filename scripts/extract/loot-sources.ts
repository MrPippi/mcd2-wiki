/** Reverse index "item -> where to get it": area pools, chests, guaranteed quest rewards, merchants by category, book pools. */
import type { Lang } from "./config";
import { issue, type Issue } from "./issues";
import { LANGS } from "./langs";
import type { ItemIndex, ItemRef } from "./loot-items";
import { exclusionRowsOf, excludedTags, poolTags, rawSlots, resolvePool, rowPool } from "./loot-pools";
import { reportLootTags } from "./loot-source-report";
import { hasPoolTags, slotKeyOf, slotsOf } from "./loot-slots";
import type { LootRow, LootSlotValue, LootTables } from "./loot-tables";
import { areaPrefix, type AreaNamer } from "./mob-areas";
import { ItemSourcesSchema, type ItemSources, type ItemSourcesData, type LootSlotKey } from "./mob-schema";
import { tagKey } from "./mob-tags";
import type { LocaleFile } from "./schemas";
import { SOURCE_NAME_KEYS, sourceName, type NameKeys, type SourceKind, type SourceName } from "./source-names";

export interface SourcesInput {
  readonly tables: LootTables;
  readonly index: ItemIndex;
  readonly namer: AreaNamer;
  readonly locales: Readonly<Record<Lang, LocaleFile>>;
  readonly nameKeys?: NameKeys;
}

type Area = ItemSources["areas"][number];
type Chest = ItemSources["chests"][number];
type Quest = ItemSources["quests"][number];
type Merchant = ItemSources["merchants"][number];
type BookPool = ItemSources["bookPools"][number];

/** One source for one item, with the languages its name shows in English. */
interface Contrib<T> {
  readonly ref: ItemRef;
  readonly entry: T;
  readonly untranslated: readonly Lang[];
}

interface Names {
  readonly of: (kind: SourceKind, id: string) => SourceName;
  readonly area: (areaId: string) => SourceName;
  readonly issues: () => Issue[];
}

interface Context {
  readonly tables: LootTables;
  readonly index: ItemIndex;
  readonly byTypeTag: ReadonlyMap<string, LootRow>;
  readonly names: Names;
}

const STRIP: Readonly<Record<SourceKind, RegExp | undefined>> = { quest: /^Quest/, bookPool: /^EnchantmentBooks(?=[A-Z])/, chest: undefined, merchant: undefined };
const AREA_STRIP = /^SW\.Area\./i;
const GLOBAL_AREA = "sw.area";
const MERCHANT_PREFIX = "sw.npc.";
const BOOK_POOL_PREFIX = "sw.lootsource.enchantmentbooks";
const CHEST_SLOTS: readonly LootSlotKey[] = ["item", "specialGear", "talismans"];
const QUEST_SLOTS: readonly LootSlotKey[] = ["specialGear", "item", "enchantedBook"];
const BOOK_SLOTS: readonly LootSlotKey[] = ["enchantedBook", "item"];

/** Memoised names; each id that fell back to English words is reported once. */
function makeNames(input: SourcesInput): Names {
  const keys = input.nameKeys ?? SOURCE_NAME_KEYS;
  const cache = new Map<string, SourceName>();
  const fallbacks: string[] = [];
  const remember = (cacheKey: string, id: string, make: () => SourceName): SourceName => {
    const known = cache.get(cacheKey);
    if (known) return known;
    const made = make();
    cache.set(cacheKey, made);
    if (!made.official) fallbacks.push(id);
    return made;
  };
  return {
    of: (kind, id) => remember(`${kind}:${id}`, id, () => sourceName(id, keys, input.locales, STRIP[kind], kind)),
    area: (areaId) => remember(`area:${areaId}`, areaId, () => {
      const name = input.namer(areaId);
      return name ? { name, untranslated: [], official: true } : sourceName(areaId, {}, input.locales, AREA_STRIP);
    }),
    issues: () => fallbacks.map((id) => issue("source-name-fallback", id)),
  };
}

const contrib = <T>(refs: readonly ItemRef[], entry: T, name: SourceName): Contrib<T>[] =>
  refs.map((ref) => ({ ref, entry, untranslated: name.untranslated }));

/** Area rows (not the global SW.Area row): every item their Item pool gives. */
function areaSources(ctx: Context): Contrib<Area>[] {
  return ctx.tables.area
    .filter((row) => tagKey(row.TypeTag.TagName) !== GLOBAL_AREA)
    .flatMap((row) => {
      const refs = resolvePool(row, "item", ctx.byTypeTag, ctx.index).items.map((item) => item.ref);
      if (refs.length === 0) return [];
      const areaId = areaPrefix(row.TypeTag.TagName);
      const name = ctx.names.area(areaId);
      return contrib(refs, { areaId, name: name.name }, name);
    });
}

/** A chest slot with its own pool gives the exact items and sets it lists; category tags are reported, not spread over every item. */
function fixedChestSlot(ctx: Context, row: LootRow, slot: LootSlotValue): { items: Contrib<Chest>[]; issues: Issue[] } {
  const tags = poolTags(slot, exclusionRowsOf(row, ctx.byTypeTag));
  const refs = tags.flatMap((tag) => ctx.index.resolve(tag));
  const categories = tags.filter((tag) => ctx.index.resolve(tag).length === 0 && ctx.index.withTrait(tag).length > 0);
  const issues = categories.length > 0 ? [issue("loot-chest-by-category", `${row.Name}: ${categories.join(", ")}`)] : [];
  if (refs.length === 0) return { items: [], issues };
  const name = ctx.names.of("chest", row.Name);
  return { items: contrib(refs, { id: row.Name, name: name.name, pool: "fixed" as const }, name), issues };
}

/** A slot whose name is no known loot slot but which lists items: what the game does with it is unclear, so it is only reported. */
const hasUnnamedPool = (row: LootRow): boolean =>
  Object.entries(row.LootDropDefinition.LootSlots ?? {}).some(([rawKey, slot]) => slotKeyOf(rawKey) === undefined && hasPoolTags(slot));

function chestSources(ctx: Context, inAreaPools: readonly ItemRef[]): { items: Contrib<Chest>[]; issues: Issue[] } {
  const fixed: Contrib<Chest>[] = [];
  const fromArea: Contrib<Chest>[] = [];
  const issues: Issue[] = ctx.tables.lootActor.filter(hasUnnamedPool).map((row) => issue("loot-slot-unnamed", row.Name));
  for (const row of ctx.tables.lootActor) {
    for (const key of CHEST_SLOTS) {
      const slot = slotsOf(row).get(key);
      if (slot === undefined) continue;
      if (hasPoolTags(slot)) {
        const found = fixedChestSlot(ctx, row, slot);
        fixed.push(...found.items);
        issues.push(...found.issues);
      } else if (slot.InheritParentDropTable && inAreaPools.length > 0) {
        const name = ctx.names.of("chest", row.Name);
        fromArea.push(...contrib(inAreaPools, { id: row.Name, name: name.name, pool: "area" as const }, name));
      }
    }
  }
  // Fixed first, so a chest that both lists an item and inherits the area pool keeps "fixed".
  return { items: [...fixed, ...fromArea], issues };
}

/** How many drops a quest slot certainly gives: the guaranteed drops, else rolls that cannot fail; 0 when nothing is certain. */
const certainDrops = (slot: LootSlotValue): number => {
  if (slot.NumberOfGuaranteedDrops > 0) return slot.NumberOfGuaranteedDrops;
  return slot.NumberOfRandomRolls > 0 && slot.DropChancePerRoll >= 1 ? slot.NumberOfRandomRolls : 0;
};

function questSources(ctx: Context): { items: Contrib<Quest>[]; issues: Issue[] } {
  const items: Contrib<Quest>[] = [];
  const notGuaranteed = new Set<string>();
  for (const row of ctx.tables.quest) {
    for (const key of QUEST_SLOTS) {
      const slot = slotsOf(row).get(key);
      if (slot === undefined || !hasPoolTags(slot)) continue;
      const count = certainDrops(slot);
      if (count === 0) {
        notGuaranteed.add(row.Name);
        continue;
      }
      const refs = resolvePool(row, key, ctx.byTypeTag, ctx.index).items.map((item) => item.ref);
      if (refs.length === 0) continue;
      const name = ctx.names.of("quest", row.Name);
      const picks = count < refs.length ? { picks: { count, of: refs.length } } : {};
      items.push(...contrib(refs, { id: row.Name, name: name.name, guaranteed: true as const, ...picks }, name));
    }
  }
  return { items, issues: [...notGuaranteed].map((name) => issue("loot-quest-not-guaranteed", name)) };
}

/** Merchants sell by category: each category tag in the pool gives every item with that trait, minus excluded ones. */
function merchantSources(ctx: Context): Contrib<Merchant>[] {
  return ctx.tables.generic
    .filter((row) => tagKey(row.TypeTag.TagName).startsWith(MERCHANT_PREFIX))
    .flatMap((row) => {
      const slot = slotsOf(row).get("item");
      if (slot === undefined) return [];
      const excluded = new Set([slot, ...exclusionRowsOf(row, ctx.byTypeTag).flatMap(rawSlots)].flatMap(excludedTags).map(tagKey));
      const allowed = (ref: ItemRef): boolean => !excluded.has(tagKey(ref.tag)) && ![...ref.traits].some((trait) => excluded.has(trait));
      return rowPool(row, "item", ctx.byTypeTag).flatMap((category) => {
        if (ctx.index.resolve(category).length > 0) return [];   // an exact item tag is not a category
        const refs = ctx.index.withTrait(category).filter(allowed);
        if (refs.length === 0) return [];
        const name = ctx.names.of("merchant", row.Name);
        return contrib(refs, { id: row.Name, name: name.name, byCategory: true as const, category }, name);
      });
    });
}

/** Book pools: trait tags expand to every book, minus the books of the exclusion rows the pool names in its traits. */
function bookSources(ctx: Context): Contrib<BookPool>[] {
  return ctx.tables.generic
    .filter((row) => tagKey(row.TypeTag.TagName).startsWith(BOOK_POOL_PREFIX))
    .flatMap((row) => {
      const refs = BOOK_SLOTS.flatMap((key) => resolvePool(row, key, ctx.byTypeTag, ctx.index).items.map((item) => item.ref));
      if (refs.length === 0) return [];
      const name = ctx.names.of("bookPool", row.Name);
      return contrib(refs, { id: row.Name, name: name.name }, name);
    });
}

const compareIds = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Item key -> its sources, each id once (the first one wins), sorted by id. */
function grouped<T>(items: readonly Contrib<T>[], idOf: (entry: T) => string): ReadonlyMap<string, readonly T[]> {
  const result = new Map<string, T[]>();
  const seen = new Set<string>();
  for (const item of items) {
    const mark = `${item.ref.key}\u0000${idOf(item.entry)}`;
    if (seen.has(mark)) continue;
    seen.add(mark);
    result.set(item.ref.key, [...(result.get(item.ref.key) ?? []), item.entry]);
  }
  return new Map([...result].map(([key, list]) => [key, [...list].sort((a, b) => compareIds(idOf(a), idOf(b)))] as const));
}

interface AllSources {
  readonly areas: readonly Contrib<Area>[];
  readonly chests: readonly Contrib<Chest>[];
  readonly quests: readonly Contrib<Quest>[];
  readonly merchants: readonly Contrib<Merchant>[];
  readonly bookPools: readonly Contrib<BookPool>[];
}

/** One ItemSources per item with any source; `untranslated` is the union over its names, left out when empty. */
function assemble(all: AllSources): ItemSourcesData {
  const byId = (entry: { id: string }): string => entry.id;
  const lists = {
    areas: grouped(all.areas, (entry) => entry.areaId),
    chests: grouped(all.chests, byId),
    quests: grouped(all.quests, byId),
    merchants: grouped(all.merchants, byId),
    bookPools: grouped(all.bookPools, byId),
  };
  const every = [...all.areas, ...all.chests, ...all.quests, ...all.merchants, ...all.bookPools];
  const english = new Map<string, Set<Lang>>();
  for (const item of every) english.set(item.ref.key, new Set([...(english.get(item.ref.key) ?? []), ...item.untranslated]));
  const keys = [...english.keys()].sort(compareIds);
  return ItemSourcesSchema.parse(Object.fromEntries(keys.map((key) => {
    const untranslated = LANGS.filter((lang) => english.get(key)?.has(lang));
    return [key, {
      areas: lists.areas.get(key) ?? [],
      chests: lists.chests.get(key) ?? [],
      quests: lists.quests.get(key) ?? [],
      merchants: lists.merchants.get(key) ?? [],
      bookPools: lists.bookPools.get(key) ?? [],
      ...(untranslated.length > 0 ? { untranslated } : {}),
    }];
  })));
}

const lootRows = (tables: LootTables): LootRow[] => [...tables.area, ...tables.generic, ...tables.mob, ...tables.lootActor, ...tables.quest];

/** Items that some area pool gives, once each, in first-seen order. */
const uniqueRefs = (items: readonly Contrib<unknown>[]): ItemRef[] => [...new Map(items.map((item) => [item.ref.key, item.ref])).values()];

export function buildItemSources(input: SourcesInput): { data: ItemSourcesData; issues: Issue[] } {
  const rows = lootRows(input.tables);
  const byTypeTag = new Map<string, LootRow>();
  for (const row of rows) if (!byTypeTag.has(tagKey(row.TypeTag.TagName))) byTypeTag.set(tagKey(row.TypeTag.TagName), row);
  const ctx: Context = { tables: input.tables, index: input.index, byTypeTag, names: makeNames(input) };
  const areas = areaSources(ctx);
  const chests = chestSources(ctx, uniqueRefs(areas));
  const quests = questSources(ctx);
  const data = assemble({ areas, chests: chests.items, quests: quests.items, merchants: merchantSources(ctx), bookPools: bookSources(ctx) });
  return { data, issues: [...reportLootTags(rows, input.index), ...quests.issues, ...chests.issues, ...ctx.names.issues()] };
}
