/** The equipment slots of the build page: what each holds, how it is grouped, and its URL parameter. Loaded by the browser, so no imports. */

export const POOL_KEYS = ["melee", "ranged", "helmet", "chest", "leggings", "boots", "artifact", "talisman"] as const;
/** Which list of items a slot picks from. */
export type PoolKey = (typeof POOL_KEYS)[number];

export const SLOT_GROUPS = ["weapons", "armor", "artifacts", "talismans"] as const;
export type SlotGroup = (typeof SLOT_GROUPS)[number];

export interface BuildSlot {
  readonly key: SlotKey;
  readonly pool: PoolKey;
  readonly group: SlotGroup;
  /** URL parameter; list slots share one, comma-separated by `index`. */
  readonly param: string;
  readonly index: number;
}

export const SLOT_KEYS = [
  "melee", "ranged", "helmet", "chest", "leggings", "boots",
  "artifact1", "artifact2", "artifact3", "talisman1", "talisman2", "talisman3",
] as const;
export type SlotKey = (typeof SLOT_KEYS)[number];

/** A build: the item slug in each filled slot. */
export type Build = Readonly<Partial<Record<SlotKey, string>>>;

const single = (key: SlotKey & PoolKey, group: SlotGroup, param: string): BuildSlot => ({ key, pool: key, group, param, index: 0 });
const listed = (key: SlotKey, pool: PoolKey, group: SlotGroup, param: string, index: number): BuildSlot => ({ key, pool, group, param, index });

export const BUILD_SLOTS: readonly BuildSlot[] = [
  single("melee", "weapons", "m"),
  single("ranged", "weapons", "r"),
  single("helmet", "armor", "h"),
  single("chest", "armor", "c"),
  single("leggings", "armor", "l"),
  single("boots", "armor", "b"),
  listed("artifact1", "artifact", "artifacts", "a", 0),
  listed("artifact2", "artifact", "artifacts", "a", 1),
  listed("artifact3", "artifact", "artifacts", "a", 2),
  listed("talisman1", "talisman", "talismans", "t", 0),
  listed("talisman2", "talisman", "talismans", "t", 1),
  listed("talisman3", "talisman", "talismans", "t", 2),
];

export const slotsIn = (group: SlotGroup): BuildSlot[] => BUILD_SLOTS.filter((slot) => slot.group === group);

/** A value per pool, like `byLang` for languages. */
export const byPool = <T>(fn: (pool: PoolKey) => T): Record<PoolKey, T> =>
  Object.fromEntries(POOL_KEYS.map((pool) => [pool, fn(pool)])) as Record<PoolKey, T>;

/** Slots that take one enchantment, in the order of the `e` URL parameter. */
export const ENCHANT_SLOT_KEYS = ["melee", "ranged", "helmet", "chest", "leggings", "boots"] as const satisfies readonly SlotKey[];
export type EnchantSlotKey = (typeof ENCHANT_SLOT_KEYS)[number];

export const ENCHANT_TIERS = [1, 2, 3] as const;
export type EnchantTier = (typeof ENCHANT_TIERS)[number];

export interface EnchantPick {
  readonly slug: string;
  readonly tier: EnchantTier;
}

/** The enchantment on each enchanted slot. */
export type Enchants = Readonly<Partial<Record<EnchantSlotKey, EnchantPick>>>;
