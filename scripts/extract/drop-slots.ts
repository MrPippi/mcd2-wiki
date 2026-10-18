/**
 * What one tag drops, slot by slot, rebuilt from the loot source rows (the 1.1.2 data and the third-party drop baseline agree
 * with these rules in every cell they share):
 * - a tag's rows are those of the tag itself, then its parents: the traits of any row that carries the tag (loot rows, loot
 *   actors, areas) and, only where a tag has none, the tag with its last segment cut;
 * - a row's slot sets the counts and the pool; with InheritParentDropTable the pool starts as its parents' merged pool and the
 *   row's own entries are applied on top, without it the pool starts empty; a row without the slot hands it to its parents;
 * - guaranteed draws and random rolls of several slots merge as the largest, the chance as the mean of the positive chances;
 * - a trigger is several tags together (a chest and its area, a quest reward and its areas): their slots merge per slot name,
 *   whatever InheritParentDropTable says, because a source's pool is only part of what it can give in an area.
 */
import { applyOps, mergePools, type MembersOf, type Op, type OpName, type Pool } from "./drop-pool";
import type { LootRow, LootSlotValue } from "./loot-tables";
import { rowsByTag } from "./quest-rewards";
import { tagKey } from "./mob-tags";

export interface Resolved {
  readonly guaranteed: number;
  readonly rolls: number;
  readonly chance: number;
  readonly pool: Pool;
}

export interface TaggedRow {
  readonly TypeTag: { readonly TagName: string };
  readonly Traits?: { readonly GameplayTags?: readonly { readonly TagName: string }[] };
}

/** Slot names in the order a profile lists them; a name outside it follows, sorted. */
export const SLOT_ORDER: readonly string[] = ["item", "specialgear", "enchantedbook", "talismans", "none"];
const OPS: readonly OpName[] = ["set", "add", "multiply"];
const SLOT_NAME = /SW\.LootSlot\.(\w+)/i;
const EMPTY_SLOT = '(TagName="")';

/** '(TagName="SW.LootSlot.EnchantedBook")' → "enchantedbook"; a slot with an empty tag name → "none"; any other key → "?<key>", which no profile uses. */
export const slotNameOf = (rawKey: string): string => SLOT_NAME.exec(rawKey)?.[1]?.toLowerCase() ?? (rawKey === EMPTY_SLOT ? "none" : `?${rawKey}`);

const slotEntries = (row: LootRow): [string, LootSlotValue][] => {
  const named = Object.entries(row.LootDropDefinition.LootSlots ?? {}).map(([key, value]): [string, LootSlotValue] => [slotNameOf(key), value]);
  return named.filter(([name], index) => named.findIndex(([other]) => other === name) === index);
};

/** The slot of the row, by lower-cased name. */
export const slotOfRow = (row: LootRow, name: string): LootSlotValue | undefined => slotEntries(row).find(([found]) => found === name)?.[1];

const isOp = (name: string): name is OpName => (OPS as readonly string[]).includes(name);

/** The pool entries of a slot as ops; an operation the model does not know is skipped. */
export const opsOf = (slot: LootSlotValue): Op[] =>
  (slot.DropTable.Tags ?? []).flatMap((entry) => {
    const op = entry.Operation.toLowerCase();
    return isOp(op) ? [{ tag: entry.TypeTag.TagName, weight: entry.Weight, op }] : [];
  });

/** Every operation name a row uses that the model does not know. */
export const unknownOperations = (rows: readonly LootRow[]): string[] => [
  ...new Set(rows.flatMap((row) => slotEntries(row).flatMap(([, slot]) => (slot.DropTable.Tags ?? []).map((entry) => entry.Operation.toLowerCase()))).filter((name) => !isOp(name))),
];

/** tag → its parents, from the traits of the given rows (any table): traits where a tag has some, else the tag without its last segment. */
export function buildHierarchy(rows: readonly TaggedRow[]): (tag: string) => readonly string[] {
  const traits = new Map<string, string[]>();
  for (const row of rows) {
    const key = tagKey(row.TypeTag.TagName);
    const own = (row.Traits?.GameplayTags ?? []).map((trait) => trait.TagName).filter((trait) => tagKey(trait) !== key);
    traits.set(key, [...new Set([...(traits.get(key) ?? []), ...own])]);
  }
  return (tag) => {
    const known = traits.get(tagKey(tag)) ?? [];
    if (known.length > 0) return known;
    const cut = tag.lastIndexOf(".");
    return cut > 0 ? [tag.slice(0, cut)] : [];
  };
}

/** The tags the starting tags reach through their parents, nearest first, each once, lower-cased. */
export function closureOf(tags: readonly string[], parents: (tag: string) => readonly string[]): string[] {
  const seen = new Set<string>();
  const queue = [...tags];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    if (seen.has(tagKey(next))) continue;
    seen.add(tagKey(next));
    queue.push(...parents(next));
  }
  return [...seen];
}

/** One slot from several: the most guaranteed draws and rolls, the mean positive chance, the merged pool. */
export function mergeSlots(slots: readonly (Resolved | undefined)[]): Resolved | undefined {
  const found = slots.filter((slot): slot is Resolved => slot !== undefined);
  if (found.length === 0) return undefined;
  const chances = found.map((slot) => slot.chance).filter((chance) => chance > 0);
  return {
    guaranteed: Math.max(...found.map((slot) => slot.guaranteed)),
    rolls: Math.max(...found.map((slot) => slot.rolls)),
    chance: chances.length > 0 ? chances.reduce((sum, chance) => sum + chance, 0) / chances.length : 0,
    pool: mergePools(found.map((slot) => slot.pool)),
  };
}

export interface SlotResolver {
  /** The slot as the tag and its parents give it; undefined when nothing in the chain has the slot. */
  readonly resolve: (tag: string, slot: string) => Resolved | undefined;
  /** The names of the slots any row of the tags' chains has, in SLOT_ORDER. */
  readonly slotNames: (tags: readonly string[]) => string[];
  /** The loops of parents met so far ("a > b > a"), each once. */
  readonly cycles: () => string[];
}

export interface ResolverInput {
  readonly rows: readonly LootRow[];
  readonly parents: (tag: string) => readonly string[];
  readonly membersOf: MembersOf;
}

/** Slots a row lists twice (the first is used) and slot keys that name no known slot: nothing is shadowed or misread without a report. */
export function slotProblems(rows: readonly LootRow[]): string[] {
  return rows.flatMap((row) => {
    const keys = Object.keys(row.LootDropDefinition.LootSlots ?? {});
    const names = keys.map(slotNameOf);
    const unknown = keys.filter((key) => key !== EMPTY_SLOT && !SLOT_NAME.test(key)).map((key) => `${row.Name}: slot key ${key} is not a loot slot`);
    const repeated = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))].map((name) => `${row.Name}: slot ${name} is listed twice, the first is used`);
    return [...unknown, ...repeated];
  });
}

export function createSlotResolver({ rows, parents, membersOf }: ResolverInput): SlotResolver {
  const byTag = rowsByTag(rows);
  const memo = new Map<string, Resolved | undefined>();
  const walking: string[] = [];
  const found = new Set<string>();
  const resolve = (tag: string, name: string): Resolved | undefined => {
    const key = `${tagKey(tag)}|${name}`;
    if (memo.has(key)) return memo.get(key);
    const at = walking.indexOf(key);
    if (at !== -1) {
      found.add([...walking.slice(at), key].map((one) => one.split("|")[0]).join(" > "));
      return undefined;
    }
    walking.push(key);
    const before = found.size;
    const row = byTag.get(tagKey(tag));
    const own = row ? slotOfRow(row, name) : undefined;
    const inherited = (): Resolved | undefined => mergeSlots(parents(tag).map((parent) => resolve(parent, name)));
    const base = own?.InheritParentDropTable ? inherited() : undefined;
    const resolved: Resolved | undefined = own
      ? {
          guaranteed: own.NumberOfGuaranteedDrops,
          rolls: own.NumberOfRandomRolls,
          chance: own.DropChancePerRoll,
          pool: applyOps(base?.pool ?? new Map(), opsOf(own), membersOf),
        }
      : inherited();
    walking.pop();
    // Only a result that did not meet a loop is final; one that did may miss what the loop cut off.
    if (found.size === before) memo.set(key, resolved);
    return resolved;
  };
  const slotNames = (tags: readonly string[]): string[] => {
    const names = new Set(closureOf(tags, parents).flatMap((tag) => (byTag.has(tag) ? slotEntries(byTag.get(tag) as LootRow).map(([name]) => name) : [])));
    const rank = (name: string): number => (SLOT_ORDER.includes(name) ? SLOT_ORDER.indexOf(name) : SLOT_ORDER.length);
    return [...names].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  };
  return { resolve, slotNames, cycles: () => [...found] };
}
