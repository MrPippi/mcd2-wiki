/**
 * Turns the planned triggers into the compact model: items numbered once, pools and profiles stored once under a hash of their
 * content (many areas share a pool, many triggers share a profile), and each source pointing at its profiles.
 */
import { createHash } from "node:crypto";
import type { DropItem, DropProfile, DropSource } from "../../shared/drop-types";
import type { Planned } from "./drop-sources";
import type { RawProfile } from "./drop-profile";
import { ExtractError } from "./issues";
import type { Universe } from "./drop-universe";

export interface Compiled {
  readonly items: DropItem[];
  readonly pools: Record<string, [number, number][]>;
  readonly profiles: Record<string, DropProfile>;
  readonly sources: DropSource[];
}

const hashOf = (value: unknown): string => createHash("sha1").update(JSON.stringify(value)).digest("hex").slice(0, 12);

/** Stores each value once under its hash; two different values under one hash would silently give a trigger the wrong odds. */
function store<T>(into: Map<string, T>, value: T, what: string): string {
  const hash = hashOf(value);
  const known = into.get(hash);
  if (known !== undefined && JSON.stringify(known) !== JSON.stringify(value)) throw new ExtractError(`drop odds: two different ${what} share the hash ${hash}`);
  into.set(hash, value);
  return hash;
}

/** Every item id the profiles draw, and the Unique variants their base items turn into. */
function usedIds(profiles: readonly RawProfile[], universe: Universe): string[] {
  const ids = new Set(profiles.flatMap((profile) => profile.slots.flatMap((slot) => slot.pool.map(([id]) => id))));
  for (const id of ids) {
    const sub = universe.items.get(id)?.sub;
    if (sub !== undefined && universe.items.has(sub)) ids.add(sub);
  }
  return [...ids];
}

/** The site key of an item id; an item without a page is "~" plus its id. */
const keyOf = (id: string, universe: Universe): string => universe.items.get(id)?.key ?? (id.startsWith("~") ? id : `~${id}`);

export function compileDrops(universe: Universe, planned: readonly Planned[]): Compiled {
  const raw = planned.flatMap((one) => one.contexts.map(([, profile]) => profile));
  const ids = usedIds(raw, universe).sort((a, b) => keyOf(a, universe).localeCompare(keyOf(b, universe)));
  const indexOf = new Map(ids.map((id, index) => [id, index] as const));
  const items = ids.map((id): DropItem => {
    const known = universe.items.get(id);
    const published = known?.key !== undefined;
    const sub = known?.sub === undefined ? undefined : indexOf.get(known.sub);
    return {
      key: keyOf(id, universe),
      group: universe.groupOf(id),
      ...(published && sub !== undefined ? { sub } : {}),
      ...(published && known?.allowed !== undefined ? { allowed: known.allowed } : {}),
      ...(published ? {} : { opaque: true as const }),
    };
  });
  const slotIndex = (id: string, owner: string): number => {
    const index = indexOf.get(id);
    if (index === undefined) throw new ExtractError(`drop odds: ${owner} draws ${id}, which is not among the items`);
    return index;
  };
  const pools = new Map<string, [number, number][]>();
  const profiles = new Map<string, DropProfile>();
  const profileOf = (profile: RawProfile): string =>
    store(
      profiles,
      {
        slots: profile.slots.map((slot) => ({
          slot: slot.slot,
          guaranteed: slot.guaranteed,
          rolls: slot.rolls,
          chance: slot.chance,
          pool: store(pools, slot.pool.map(([id, weight]): [number, number] => [slotIndex(id, slot.slot), weight]).sort((a, b) => a[0] - b[0]), "pools"),
        })),
        rarity: profile.rarity,
      },
      "profiles",
    );
  const sources = planned.map((one): DropSource => ({
    id: one.id,
    kind: one.kind,
    ...(one.first ? { first: true as const } : {}),
    ...(one.unplaced ? { unplaced: true as const } : {}),
    contexts: one.contexts.map(([area, profile]) => [area, profileOf(profile)] as const),
  }));
  return { items, pools: Object.fromEntries(pools), profiles: Object.fromEntries(profiles), sources };
}
