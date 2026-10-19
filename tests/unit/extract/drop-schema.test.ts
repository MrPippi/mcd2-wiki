import { describe, expect, it } from "vitest";
import { DropDataSchema } from "../../../scripts/extract/drop-schema";
import { MAX_DRAWS } from "../../../src/lib/drop-odds";

const valid = () => ({
  levels: [1, 2],
  rarityFactors: [[1, 1, 1, 1], [0.5, 0.5, 1, 1]],
  difficulties: { normal: [], low: [[3, "m", 0]] },
  slots: { item: { history: 3, oneOfAKind: false } },
  items: [{ key: "melee/sword", group: "melee", sub: 1 }, { key: "melee/sword-unique1", group: "melee", allowed: 8 }, { key: "~currency", group: "~currency", opaque: true }],
  pools: { aaa: [[0, 1], [2, 0.5]] },
  profiles: { bbb: { slots: [{ slot: "item", guaranteed: 1, rolls: 0, chance: 0, pool: "aaa" }], rarity: [[0, "s", 50]] } },
  sources: [{ id: "chest:FancyChest", kind: "chest", contexts: [["area:SW.Area.Plains.A1", "bbb"]] }],
});
const parse = (change: (data: ReturnType<typeof valid>) => unknown) => DropDataSchema.safeParse(change(valid()));
const messages = (result: ReturnType<typeof parse>) => (result.success ? [] : result.error.issues.map((one) => one.message));

describe("DropDataSchema", () => {
  it("accepts a consistent model", () => {
    expect(DropDataSchema.safeParse(valid()).success).toBe(true);
  });

  it("knows the regular mob source kind and no other new one", () => {
    expect(parse((data) => ({ ...data, sources: [{ id: "regular:Hostile", kind: "regular", contexts: [["area:SW.Area.Plains.A1", "bbb"]] }] })).success).toBe(true);
    expect(parse((data) => ({ ...data, sources: [{ id: "x", kind: "merchant", contexts: [["", "bbb"]] }] })).success).toBe(false);
  });

  it("refuses fields it does not know, at any level", () => {
    expect(parse((data) => ({ ...data, extra: 1 })).success).toBe(false);
    expect(parse((data) => ({ ...data, items: [{ ...data.items[0], extra: 1 }] })).success).toBe(false);
    expect(parse((data) => ({ ...data, sources: [{ ...data.sources[0], extra: 1 }] })).success).toBe(false);
  });

  it("wants one set of rarity factors per ascending threat level", () => {
    expect(messages(parse((data) => ({ ...data, levels: [2, 1] })))).toContain("threat levels must be unique and ascending");
    expect(messages(parse((data) => ({ ...data, rarityFactors: [[1, 1, 1, 1]] })))).toContain("one set of rarity factors per threat level");
  });

  it("wants the normal difficulty", () => {
    expect(messages(parse((data) => ({ ...data, difficulties: { low: [] } })))).toContain("the normal difficulty is missing");
  });

  it("checks that every reference points at something", () => {
    expect(messages(parse((data) => ({ ...data, pools: { aaa: [[7, 1]] } })))).toContain("unknown item 7");
    expect(messages(parse((data) => ({ ...data, profiles: { bbb: { ...data.profiles.bbb, slots: [{ ...data.profiles.bbb.slots[0], pool: "zzz" }] } } })))).toContain("unknown pool zzz");
    expect(messages(parse((data) => ({ ...data, sources: [{ ...data.sources[0], contexts: [["", "nope"]] }] })))).toContain("unknown profile nope");
  });

  it("wants a Unique variant to be Unique, and item keys and source ids to be unique", () => {
    expect(messages(parse((data) => ({ ...data, items: [{ ...data.items[0], sub: 2 }, data.items[1], data.items[2]] })))).toContain("item melee/sword turns into an item that is not Unique");
    expect(messages(parse((data) => ({ ...data, items: [data.items[0], data.items[0], data.items[2]] })))).toContain("item keys must be unique");
    expect(messages(parse((data) => ({ ...data, sources: [data.sources[0], data.sources[0]] })))).toContain("source ids must be unique");
  });

  it("bounds the draws of a slot and keeps chances and weights in range", () => {
    const slot = (over: object) => (data: ReturnType<typeof valid>) => ({ ...data, profiles: { bbb: { ...data.profiles.bbb, slots: [{ ...data.profiles.bbb.slots[0], ...over }] } } });
    expect(messages(parse(slot({ guaranteed: MAX_DRAWS, rolls: 1 })))).toContain(`a slot draws at most ${MAX_DRAWS} times`);
    expect(parse(slot({ chance: 1.5 })).success).toBe(false);
    expect(parse(slot({ slot: "emeralds" })).success).toBe(false);
    expect(parse((data) => ({ ...data, pools: { aaa: [[0, 0]] } })).success).toBe(false);
  });

  it("keeps rarity masks in range, off items without a page, and accepts an unplaced source", () => {
    expect(parse((data) => ({ ...data, items: [{ ...data.items[0], allowed: 16 }, data.items[1], data.items[2]] })).success).toBe(false);
    expect(parse((data) => ({ ...data, items: [{ ...data.items[0], allowed: 0 }, data.items[1], data.items[2]] })).success).toBe(false);
    expect(messages(parse((data) => ({ ...data, items: [data.items[0], data.items[1], { ...data.items[2], allowed: 7 }] })))).toContain("item ~currency has no page, so no rarity");
    expect(parse((data) => ({ ...data, sources: [{ ...data.sources[0], unplaced: true }] })).success).toBe(true);
  });

  it("refuses a profile or source with nothing in it", () => {
    expect(parse((data) => ({ ...data, profiles: { bbb: { slots: [], rarity: [] } } })).success).toBe(false);
    expect(parse((data) => ({ ...data, sources: [{ ...data.sources[0], contexts: [] }] })).success).toBe(false);
  });
});
