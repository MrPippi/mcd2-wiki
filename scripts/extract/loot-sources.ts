/** Reverse index "item -> where to get it": area pools, chests, guaranteed quest rewards, merchants by category, book pools and their droppers. */
import type { Lang } from "./config";
import { issue, type Issue } from "./issues";
import type { ItemIndex, ItemRef } from "./loot-items";
import { exclusionRowsOf, excludedTags, poolTags, rawSlots, resolvePool, rowPool } from "./loot-pools";
import { reportLootTags } from "./loot-source-report";
import { hasPoolTags, slotKeyOf, slotsOf } from "./loot-slots";
import type { LootRow, LootSlotValue, LootTables } from "./loot-tables";
import { areaPrefix, type AreaNamer } from "./mob-areas";
import { ItemSourcesSchema, type BookDrop, type ItemSources, type ItemSourcesData, type LootSlotKey, type LootSource, type SourceKindName } from "./mob-schema";
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

type Chest = ItemSources["chests"][number];
type Quest = ItemSources["quests"][number];
type Merchant = ItemSources["merchants"][number];

/** One source for one item. */
interface Contrib<T> {
  readonly ref: ItemRef;
  readonly entry: T;
}

/** Names each source once and hands out its id ("<kind>:<row id>"); fallback names are reported once per row id. */
interface Registry {
  readonly add: (kind: SourceKindName, id: string) => string;
  readonly sources: () => Record<string, LootSource>;
  readonly issues: () => Issue[];
}

interface Context {
  readonly tables: LootTables;
  readonly index: ItemIndex;
  readonly byTypeTag: ReadonlyMap<string, LootRow>;
  readonly names: Registry;
}

const STRIP: Readonly<Record<SourceKind, RegExp | undefined>> = { quest: /^Quest/, bookPool: /^EnchantmentBooks(?=[A-Z])/, chest: undefined, mob: undefined, merchant: undefined };
const AREA_STRIP = /^SW\.Area\./i;
const GLOBAL_AREA = "sw.area";
const MERCHANT_PREFIX = "sw.npc.";
const BOOK_POOL_PREFIX = "sw.lootsource.enchantmentbooks";
const CHEST_SLOTS: readonly LootSlotKey[] = ["item", "specialGear", "talismans"];
const QUEST_SLOTS: readonly LootSlotKey[] = ["specialGear", "item", "enchantedBook"];
const BOOK_SLOTS: readonly LootSlotKey[] = ["enchantedBook", "item"];
/** A procedural chest row is the same chest the page already names (FancyChest_Procedural -> FancyChest). */
const PROCEDURAL_SUFFIX = /_Procedural$/;

const compareIds = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function makeRegistry(input: SourcesInput): Registry {
  const keys = input.nameKeys ?? SOURCE_NAME_KEYS;
  const named = new Map<string, LootSource>();
  const fallbacks: string[] = [];
  const nameOf = (kind: SourceKindName, id: string): SourceName => {
    if (kind !== "area") return sourceName(id, keys, input.locales, STRIP[kind], kind);
    const name = input.namer(id);
    return name ? { name, untranslated: [], official: true } : sourceName(id, {}, input.locales, AREA_STRIP);
  };
  return {
    add: (kind, id) => {
      const sourceId = `${kind}:${id}`;
      if (!named.has(sourceId)) {
        const made = nameOf(kind, id);
        named.set(sourceId, { kind, name: made.name, untranslated: [...made.untranslated] });
        if (!made.official) fallbacks.push(id);
      }
      return sourceId;
    },
    sources: () => Object.fromEntries([...named].sort(([a], [b]) => compareIds(a, b))),
    issues: () => fallbacks.map((id) => issue("source-name-fallback", id)),
  };
}

const contrib = <T>(refs: readonly ItemRef[], entry: T): Contrib<T>[] => refs.map((ref) => ({ ref, entry }));

/** Area rows (not the global SW.Area row): every item their Item pool gives. */
function areaSources(ctx: Context): Contrib<string>[] {
  return ctx.tables.area
    .filter((row) => tagKey(row.TypeTag.TagName) !== GLOBAL_AREA)
    .flatMap((row) => {
      const refs = resolvePool(row, "item", ctx.byTypeTag, ctx.index).items.map((item) => item.ref);
      return refs.length === 0 ? [] : contrib(refs, ctx.names.add("area", areaPrefix(row.TypeTag.TagName)));
    });
}

/** A chest slot with its own pool gives the exact items and sets it lists; category tags are reported, not spread over every item. */
function fixedChestSlot(ctx: Context, row: LootRow, slot: LootSlotValue): { items: Contrib<Chest>[]; issues: Issue[] } {
  const tags = poolTags(slot, exclusionRowsOf(row, ctx.byTypeTag));
  const refs = tags.flatMap((tag) => ctx.index.resolve(tag));
  const categories = tags.filter((tag) => ctx.index.resolve(tag).length === 0 && ctx.index.withTrait(tag).length > 0);
  const issues = categories.length > 0 ? [issue("loot-chest-by-category", `${row.Name}: ${categories.join(", ")}`)] : [];
  if (refs.length === 0) return { items: [], issues };
  return { items: contrib(refs, { id: ctx.names.add("chest", row.Name), pool: "fixed" as const }), issues };
}

/** Slots whose name is no known loot slot but which list items (CampWoodenChest): they count as fixed contents (Ruling 26). */
const unnamedPoolSlots = (row: LootRow): LootSlotValue[] =>
  Object.entries(row.LootDropDefinition.LootSlots ?? {}).flatMap(([rawKey, slot]) => (slotKeyOf(rawKey) === undefined && hasPoolTags(slot) ? [slot] : []));

function chestSources(ctx: Context, inAreaPools: readonly ItemRef[]): { items: Contrib<Chest>[]; issues: Issue[] } {
  const fixed: Contrib<Chest>[] = [];
  const fromArea: Contrib<Chest>[] = [];
  const issues: Issue[] = [];
  for (const row of ctx.tables.lootActor) {
    const unnamed = unnamedPoolSlots(row);
    if (unnamed.length > 0) issues.push(issue("loot-slot-unnamed", row.Name));
    const named = CHEST_SLOTS.flatMap((key) => slotsOf(row).get(key) ?? []);
    for (const slot of [...named, ...unnamed]) {
      if (hasPoolTags(slot)) {
        const found = fixedChestSlot(ctx, row, slot);
        fixed.push(...found.items);
        issues.push(...found.issues);
      } else if (slot.InheritParentDropTable && inAreaPools.length > 0) {
        fromArea.push(...contrib(inAreaPools, { id: ctx.names.add("chest", row.Name), pool: "area" as const }));
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
      const picks = count < refs.length ? { picks: { count, of: refs.length } } : {};
      items.push(...contrib(refs, { id: ctx.names.add("quest", row.Name), ...picks }));
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
        return refs.length === 0 ? [] : contrib(refs, { id: ctx.names.add("merchant", row.Name), category });
      });
    });
}

/** Book pool tags some area row names in its traits: the pools chests and mobs there draw from. */
const areaBookPools = (tables: LootTables): ReadonlySet<string> =>
  new Set(tables.area.flatMap((row) => (row.Traits?.GameplayTags ?? []).map((tag) => tagKey(tag.TagName)).filter((tag) => tag.startsWith(BOOK_POOL_PREFIX))));

/**
 * Book pools an area draws from (AllEnchantmentBooks, which no area names, is left out): trait tags expand to every
 * book, minus the books of the exclusion rows the pool names in its traits.
 */
function bookSources(ctx: Context): Contrib<string>[] {
  const used = areaBookPools(ctx.tables);
  return ctx.tables.generic
    .filter((row) => used.has(tagKey(row.TypeTag.TagName)))
    .flatMap((row) => {
      const refs = BOOK_SLOTS.flatMap((key) => resolvePool(row, key, ctx.byTypeTag, ctx.index).items.map((item) => item.ref));
      return refs.length === 0 ? [] : contrib(refs, ctx.names.add("bookPool", row.Name));
    });
}

/** Chests and mobs whose book slot lists nothing itself and takes the area's book pool. */
function bookDrops(ctx: Context): BookDrop[] {
  const droppers = [
    ...ctx.tables.lootActor.map((row) => ({ row, kind: "chest" as const })),
    ...ctx.tables.mob.map((row) => ({ row, kind: "mob" as const })),
  ];
  return droppers.flatMap(({ row, kind }) => {
    const slot = slotsOf(row).get("enchantedBook");
    if (slot === undefined || hasPoolTags(slot) || !slot.InheritParentDropTable) return [];
    const id = ctx.names.add(kind, row.Name.replace(PROCEDURAL_SUFFIX, ""));
    return [{ id, guaranteed: slot.NumberOfGuaranteedDrops, rolls: slot.NumberOfRandomRolls, chancePerRoll: slot.DropChancePerRoll }];
  }).sort((a, b) => compareIds(a.id, b.id));
}

/** Item key -> its sources, each id once (the first one wins), sorted by id. */
function grouped<T>(items: readonly Contrib<T>[], idOf: (entry: T) => string): ReadonlyMap<string, T[]> {
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
  readonly areas: readonly Contrib<string>[];
  readonly chests: readonly Contrib<Chest>[];
  readonly quests: readonly Contrib<Quest>[];
  readonly merchants: readonly Contrib<Merchant>[];
  readonly bookPools: readonly Contrib<string>[];
}

/** One ItemSources per item with any source. */
function assembleItems(all: AllSources): Record<string, ItemSources> {
  const self = (id: string): string => id;
  const byId = (entry: { id: string }): string => entry.id;
  const lists = {
    areas: grouped(all.areas, self),
    chests: grouped(all.chests, byId),
    quests: grouped(all.quests, byId),
    merchants: grouped(all.merchants, byId),
    bookPools: grouped(all.bookPools, self),
  };
  const every = [...all.areas, ...all.chests, ...all.quests, ...all.merchants, ...all.bookPools];
  const keys = [...new Set(every.map((item) => item.ref.key))].sort(compareIds);
  return Object.fromEntries(keys.map((key) => [key, {
    areas: lists.areas.get(key) ?? [],
    chests: lists.chests.get(key) ?? [],
    quests: lists.quests.get(key) ?? [],
    merchants: lists.merchants.get(key) ?? [],
    bookPools: lists.bookPools.get(key) ?? [],
  }]));
}

const lootRows = (tables: LootTables): LootRow[] => [...tables.area, ...tables.generic, ...tables.mob, ...tables.lootActor, ...tables.quest];

/** Items that some area pool gives, once each, in first-seen order. */
const uniqueRefs = (items: readonly Contrib<unknown>[]): ItemRef[] => [...new Map(items.map((item) => [item.ref.key, item.ref])).values()];

export function buildItemSources(input: SourcesInput): { data: ItemSourcesData; issues: Issue[] } {
  const rows = lootRows(input.tables);
  const byTypeTag = new Map<string, LootRow>();
  for (const row of rows) if (!byTypeTag.has(tagKey(row.TypeTag.TagName))) byTypeTag.set(tagKey(row.TypeTag.TagName), row);
  const ctx: Context = { tables: input.tables, index: input.index, byTypeTag, names: makeRegistry(input) };
  const areas = areaSources(ctx);
  const chests = chestSources(ctx, uniqueRefs(areas));
  const quests = questSources(ctx);
  const items = assembleItems({ areas, chests: chests.items, quests: quests.items, merchants: merchantSources(ctx), bookPools: bookSources(ctx) });
  const drops = bookDrops(ctx);
  const data = ItemSourcesSchema.parse({ sources: ctx.names.sources(), items, bookDrops: drops });
  return { data, issues: [...reportLootTags(rows, input.index), ...quests.issues, ...chests.issues, ...ctx.names.issues()] };
}
