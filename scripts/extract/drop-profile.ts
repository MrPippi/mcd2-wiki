/**
 * The profile of one trigger: the item-bearing slots it can roll and the rarity rows that apply, before items are numbered.
 * A trigger is several tags together (see drop-slots.ts); a mob is a counted list of slots over its area's pool instead.
 */
import { mergePools, poolWeights } from "./drop-pool";
import { contextRarityOps, type RarityRow } from "./drop-rarity-rows";
import { tagKey } from "./mob-tags";
import { closureOf, mergeSlots, type Resolved, type SlotResolver } from "./drop-slots";
import { MAX_DRAWS, MAX_STATES, slotStates } from "../../shared/drop-odds";
import type { DropSlotRule, RarityOp } from "../../shared/drop-types";

/** The slots that can give an item; emeralds, spring stones, food and TNT are not items the site has pages for. */
export const ITEM_SLOTS: readonly string[] = ["item", "specialgear", "enchantedbook", "talismans", "none"];

export interface RawSlot {
  readonly slot: string;
  readonly guaranteed: number;
  readonly rolls: number;
  readonly chance: number;
  /** Item id → weight, only the entries that can be drawn. */
  readonly pool: readonly (readonly [string, number])[];
}

export interface RawProfile {
  readonly slots: readonly RawSlot[];
  readonly rarity: readonly RarityOp[];
  /** Slots left out because the calculation would not follow them, each with the reason. */
  readonly skipped: readonly string[];
}

export interface ProfileContext {
  readonly resolver: SlotResolver;
  readonly parents: (tag: string) => readonly string[];
  readonly rarityRows: readonly RarityRow[];
  /** Whether an item id is one the site has a page for (a pool without one tells nothing a page can show). */
  readonly isPublished: (id: string) => boolean;
  /** The slot rules by slot name. */
  readonly rules: Readonly<Record<string, DropSlotRule>>;
  /** The recent-drop history group of an item id. */
  readonly groupOf: (id: string) => string;
}

interface Built {
  readonly slots: RawSlot[];
  readonly skipped: string[];
}

/** Why the calculation would not follow a slot, or undefined when it would. */
function tooBig(context: ProfileContext, name: string, draws: number, pool: readonly (readonly [string, number])[]): string | undefined {
  if (draws > MAX_DRAWS) return `${name}: ${draws} draws (at most ${MAX_DRAWS})`;
  const rule = Object.hasOwn(context.rules, name) ? context.rules[name] : { history: 0, oneOfAKind: false };
  const states = slotStates(pool.length, new Set(pool.map(([id]) => context.groupOf(id))).size, rule, draws);
  return states > MAX_STATES ? `${name}: about ${states} states for ${draws} draws from ${pool.length} items (at most ${MAX_STATES})` : undefined;
}

/** A slot that draws at least once and can draw a published item; the others are dropped, those too big to follow are reported. */
function usable(context: ProfileContext, name: string, merged: Resolved | undefined): Built {
  if (!merged || (merged.guaranteed <= 0 && !(merged.rolls > 0 && merged.chance > 0))) return { slots: [], skipped: [] };
  const pool = poolWeights(merged.pool);
  if (!pool.some(([id]) => context.isPublished(id))) return { slots: [], skipped: [] };
  const reason = tooBig(context, name, merged.guaranteed + merged.rolls, pool);
  if (reason) return { slots: [], skipped: [reason] };
  return { slots: [{ slot: name, guaranteed: merged.guaranteed, rolls: merged.rolls, chance: merged.chance, pool }], skipped: [] };
}

const profileOf = (context: ProfileContext, built: readonly Built[], tags: readonly string[]): RawProfile => ({
  slots: built.flatMap((one) => one.slots),
  skipped: built.flatMap((one) => one.skipped),
  rarity: contextRarityOps(closureOf(tags, context.parents), context.rarityRows),
});

/** The profile of a trigger made of these tags together (a chest and its area, a quest reward and its areas). */
export function profileOfTags(context: ProfileContext, tags: readonly string[]): RawProfile {
  // A tag twice (a quest's area named by the entry and by the quest) must not count twice.
  const once = tags.filter((tag, index) => tags.findIndex((other) => tagKey(other) === tagKey(tag)) === index);
  const names = context.resolver.slotNames(once).filter((name) => ITEM_SLOTS.includes(name));
  return profileOf(context, names.map((name) => usable(context, name, mergeSlots(once.map((tag) => context.resolver.resolve(tag, name))))), once);
}

export interface SlotSpec {
  readonly slot: string;
  readonly guaranteed: number;
  readonly rolls: number;
  readonly chance: number;
}

/**
 * The profile of a source whose counts are given (a mob) and whose pools come from the area tag; `tags` feed the rarity rows.
 * `poolTags` name rows whose own pool ops (a Multiply on artifacts) are merged into the area's pool.
 */
export function profileOfSpecs(context: ProfileContext, specs: readonly SlotSpec[], areaTag: string, tags: readonly string[], poolTags: readonly string[] = []): RawProfile {
  const built = specs.map((spec) => {
    const area = context.resolver.resolve(areaTag, spec.slot);
    const extra = poolTags.map((tag) => context.resolver.resolve(tag, spec.slot)?.pool);
    return usable(context, spec.slot, area && { ...spec, pool: mergePools([area.pool, ...extra.filter((pool) => pool !== undefined)]) });
  });
  return profileOf(context, built, [...tags, areaTag]);
}
