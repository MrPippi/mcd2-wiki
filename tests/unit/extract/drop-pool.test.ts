import { describe, expect, it } from "vitest";
import { applyOps, mergePools, poolWeights, type Op, type Pool } from "../../../scripts/extract/drop-pool";

const MEMBERS: Readonly<Record<string, readonly string[]>> = {
  "sw.item.property.melee": ["sw.item.sword", "sw.item.mace", "sw.item.axe", "sw.item.pike"],
  "sw.item.armorset.mystic": ["sw.item.mystichelmet", "sw.item.mysticchest"],
  "sw.item.sword": ["sw.item.sword"],
};
const lookup = (extra: Readonly<Record<string, readonly string[]>> = {}) => (tag: string): readonly string[] => ({ ...MEMBERS, ...extra })[tag.toLowerCase()] ?? [];
const members = lookup();
const set = (tag: string, weight: number): Op => ({ tag, weight, op: "set" });
const add = (tag: string, weight: number): Op => ({ tag, weight, op: "add" });
const times = (tag: string, weight: number): Op => ({ tag, weight, op: "multiply" });
const weights = (pool: Pool): Record<string, number> => Object.fromEntries(poolWeights(pool));
const empty: Pool = new Map();

describe("applyOps", () => {
  it("splits a Set over the members of a group tag", () => {
    expect(weights(applyOps(empty, [set("SW.Item.Property.Melee", 2)], members))).toEqual({
      "sw.item.sword": 0.5, "sw.item.mace": 0.5, "sw.item.axe": 0.5, "sw.item.pike": 0.5,
    });
    expect(weights(applyOps(empty, [set("SW.Item.ArmorSet.Mystic", 1)], members))).toEqual({ "sw.item.mystichelmet": 0.5, "sw.item.mysticchest": 0.5 });
  });

  it("keeps a tag that names no item as a pool entry of its own, so it still takes weight", () => {
    expect(weights(applyOps(empty, [set("SW.Item.Currency.SpringStone", 1), set("SW.Item.Currency.Springstone", 1)], members))).toEqual({ "~sw.item.currency.springstone": 1 });
  });

  it("lets a later Set replace the earlier ops of the same item, and Add and Multiply build on the Set", () => {
    const pool = applyOps(empty, [set("SW.Item.Sword", 1), add("SW.Item.Sword", 2), times("SW.Item.Sword", 0.5)], members);
    expect(weights(pool)).toEqual({ "sw.item.sword": 1.5 });
    expect(weights(applyOps(pool, [set("SW.Item.Sword", 4)], members))).toEqual({ "sw.item.sword": 4 });
  });

  it("removes what a Multiply of 0 reaches, group tags included", () => {
    const pool = applyOps(empty, [set("SW.Item.Property.Melee", 4), times("SW.Item.Pike", 0)], lookup({ "sw.item.pike": ["sw.item.pike"] }));
    expect(Object.keys(weights(pool))).toEqual(["sw.item.sword", "sw.item.mace", "sw.item.axe"]);
  });

  it("does not change the pool it is given", () => {
    const base = applyOps(empty, [set("SW.Item.Sword", 1)], members);
    applyOps(base, [set("SW.Item.Sword", 5)], members);
    expect(weights(base)).toEqual({ "sw.item.sword": 1 });
  });
});

describe("mergePools", () => {
  it("takes the largest Set, sums Add and multiplies Multiply across pools", () => {
    const a = applyOps(empty, [set("SW.Item.Sword", 1), times("SW.Item.Sword", 0.5)], members);
    const b = applyOps(empty, [set("SW.Item.Sword", 0.25), add("SW.Item.Sword", 1), times("SW.Item.Sword", 0.5)], members);
    expect(weights(mergePools([a, b]))).toEqual({ "sw.item.sword": (1 + 1) * 0.25 });
  });

  it("keeps items that only one pool has", () => {
    const merged = mergePools([applyOps(empty, [set("SW.Item.Sword", 1)], members), applyOps(empty, [set("SW.Item.ArmorSet.Mystic", 1)], members)]);
    expect(Object.keys(weights(merged)).sort()).toEqual(["sw.item.mystichelmet", "sw.item.mysticchest", "sw.item.sword"].sort());
  });

  it("is an empty pool for no pools", () => {
    expect(weights(mergePools([]))).toEqual({});
  });
});

describe("poolWeights", () => {
  it("leaves out items with no Set or Add and items a Multiply took to 0 or below", () => {
    const pool = applyOps(empty, [times("SW.Item.Sword", 2), set("SW.Item.Mace", 1), times("SW.Item.Mace", 0), add("SW.Item.Axe", -1)], lookup({ "sw.item.mace": ["sw.item.mace"], "sw.item.axe": ["sw.item.axe"] }));
    expect(weights(pool)).toEqual({});
  });
});
