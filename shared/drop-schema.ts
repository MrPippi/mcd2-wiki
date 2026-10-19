import { z } from "zod";
import { MAX_DRAWS } from "./drop-odds";

/** The slots a profile can hold (extractor and site agree on these names). */
export const DROP_SLOT_NAMES = ["item", "specialgear", "enchantedbook", "talismans", "none"] as const;

/** The rarity mask of an item that only exists as Unique. */
const UNIQUE_ONLY = 8;
const Rarity = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
const RarityOpSchema = z.tuple([Rarity, z.enum(["s", "a", "m"]), z.number().finite()]);
const Weight = z.number().finite().positive();
const Index = z.number().int().min(0);

const ItemSchema = z.strictObject({
  /** "<category>/<slug>" for an item with a page, "~<tag>" for one without. */
  key: z.string().min(1),
  group: z.string().min(1),
  sub: Index.optional(),
  allowed: z.number().int().min(1).max(15).optional(),
  opaque: z.literal(true).optional(),
});

const SlotSchema = z
  .strictObject({
    slot: z.enum(DROP_SLOT_NAMES),
    guaranteed: Index,
    rolls: Index,
    chance: z.number().finite().min(0).max(1),
    pool: z.string().min(1),
  })
  .refine((one) => one.guaranteed + one.rolls <= MAX_DRAWS, { message: `a slot draws at most ${MAX_DRAWS} times` });

const ProfileSchema = z.strictObject({ slots: z.array(SlotSchema).min(1), rarity: z.array(RarityOpSchema) });

const SourceSchema = z.strictObject({
  /** The loot-sources id ("chest:FancyChest", "mob:PiggyBank") or "quest:<quest id>:<reward batch>". */
  id: z.string().min(1),
  kind: z.enum(["chest", "quest", "mob", "regular"]),
  first: z.literal(true).optional(),
  unplaced: z.literal(true).optional(),
  /** Area source id ("" for none) and the profile that applies there. */
  contexts: z.array(z.tuple([z.string(), z.string().min(1)])).min(1),
});

const SlotRuleSchema = z.strictObject({ history: Index, oneOfAKind: z.boolean() });

const strictlyAscending = (values: readonly number[]): boolean => values.every((value, index) => index === 0 || value > values[index - 1]);

export const DropDataSchema = z
  .strictObject({
    /** Threat levels, and for each the factor of Common, Rare, Special and Unique rarity weights. */
    levels: z.array(z.number().int().min(1)),
    rarityFactors: z.array(z.tuple([z.number().finite().min(0), z.number().finite().min(0), z.number().finite().min(0), z.number().finite().min(0)])),
    difficulties: z.record(z.string(), z.array(RarityOpSchema)),
    slots: z.record(z.string(), SlotRuleSchema),
    items: z.array(ItemSchema),
    pools: z.record(z.string(), z.array(z.tuple([Index, Weight])).min(1)),
    profiles: z.record(z.string(), ProfileSchema),
    sources: z.array(SourceSchema),
  })
  .superRefine((data, context) => {
    const fail = (path: (string | number)[], message: string): void => {
      context.addIssue({ code: "custom", path, message });
    };
    if (!strictlyAscending(data.levels)) fail(["levels"], "threat levels must be unique and ascending");
    if (data.rarityFactors.length !== data.levels.length) fail(["rarityFactors"], "one set of rarity factors per threat level");
    if (!Object.hasOwn(data.difficulties, "normal")) fail(["difficulties"], "the normal difficulty is missing");
    const keys = data.items.map((item) => item.key);
    if (new Set(keys).size !== keys.length) fail(["items"], "item keys must be unique");
    data.items.forEach((item, at) => {
      if (item.sub !== undefined && data.items[item.sub]?.allowed !== UNIQUE_ONLY) fail(["items", at, "sub"], `item ${item.key} turns into an item that is not Unique`);
      if (item.opaque && item.allowed !== undefined) fail(["items", at, "allowed"], `item ${item.key} has no page, so no rarity`);
    });
    for (const [hash, pool] of Object.entries(data.pools)) {
      pool.forEach(([item], at) => {
        if (item >= data.items.length) fail(["pools", hash, at], `unknown item ${item}`);
      });
    }
    for (const [hash, profile] of Object.entries(data.profiles)) {
      profile.slots.forEach((slot, at) => {
        if (!Object.hasOwn(data.pools, slot.pool)) fail(["profiles", hash, "slots", at, "pool"], `unknown pool ${slot.pool}`);
      });
    }
    const ids = data.sources.map((source) => source.id);
    if (new Set(ids).size !== ids.length) fail(["sources"], "source ids must be unique");
    data.sources.forEach((source, at) => {
      source.contexts.forEach(([, profile], index) => {
        if (!Object.hasOwn(data.profiles, profile)) fail(["sources", at, "contexts", index], `unknown profile ${profile}`);
      });
    });
  });
export type DropData = z.infer<typeof DropDataSchema>;
