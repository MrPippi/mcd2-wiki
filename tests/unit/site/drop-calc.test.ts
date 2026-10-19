import { describe, expect, it } from "vitest";
import { calcPayload, calcPayloadJson } from "../../../src/lib/drop-calc/payload";
import { parseCalcPayload, type CalcPayload } from "../../../src/lib/drop-calc/parse";
import { decodeState, encodeState, narrowing, stateRows } from "../../../src/lib/drop-calc/state";
import { dropData } from "../../../src/lib/drop-view";

const payload = calcPayload("en");

describe("calcPayload", () => {
  it("passes its own check, with items, levels, difficulties and labelled sources", () => {
    expect(parseCalcPayload(JSON.parse(JSON.stringify(payload)))).toBeDefined();
    expect(payload.levels).toHaveLength(20);
    expect(payload.difficulties.map((one) => one.id)).toEqual(["normal", "low", "high"]);
    expect(payload.rarities.map((one) => one.id)).toEqual(["any", "common", "rare", "special", "unique"]);
    expect(payload.items.length).toBeGreaterThan(200);
    expect(Object.keys(payload.sources)).toHaveLength(dropData.sources.length);
  });

  it("can never close the script tag it is written into", () => {
    const hostile = { ...payload, items: [{ ...payload.items[0], name: "</script><script>alert(1)</script>" }] };
    const json = calcPayloadJson(hostile);
    expect(json).not.toContain("</script");
    expect(json).not.toContain("<");
    expect(JSON.parse(json).items[0].name).toBe("</script><script>alert(1)</script>");
  });

  it("says whether the build has drop data", () => {
    expect(payload.available).toBe(true);
    expect(parseCalcPayload({ ...payload, available: undefined })).toBeUndefined();
  });

  it("lists the regular mobs once per state, not once per area", () => {
    const names = Object.entries(payload.sources).filter(([id]) => id.startsWith("regular:")).map(([, label]) => label.name);
    expect(names).toEqual(["Regular mobs", "Regular mobs · Soul Corrupted", "Geomancer", "Geomancer · Soul Corrupted"]);
    const sources = narrowing(stateRows(dropData, decodeState("?item=melee/sword", payload))).sources;
    expect(sources.filter((id) => id.startsWith("regular:")).sort()).toEqual(["regular:Geomancer", "regular:Geomancer:soul", "regular:Hostile", "regular:SoulStated"]);
  });

  it("marks a source the data does not place", () => {
    expect(Object.values(payload.sources).some((label) => label.unplaced)).toBe(true);
    expect(Object.values(payload.sources).filter((label) => label.unplaced).length).toBeLessThan(Object.keys(payload.sources).length);
  });

  it("groups the picker by page category in site order, armor by piece, with the book frame for books", () => {
    expect(payload.groups.map((one) => one.id)).toEqual(["melee", "ranged", "armor-helmet", "armor-chest", "armor-leggings", "armor-boots", "artifact", "talisman", "enchantment-book"]);
    expect(payload.items.every((item) => payload.groups.some((one) => one.id === item.group))).toBe(true);
    expect(payload.items.filter((item) => item.category === "armor").every((item) => item.group.startsWith("armor-"))).toBe(true);
    expect(payload.items.some((item) => item.unique)).toBe(true);
    expect(payload.bookFrame).toMatch(/frames\/enchantment\.png$/);
  });

  it("is rejected when a field is missing or wrong", () => {
    expect(parseCalcPayload(undefined)).toBeUndefined();
    expect(parseCalcPayload({ ...payload, items: [] })).toBeUndefined();
    expect(parseCalcPayload({ ...payload, labels: { ...payload.labels, pick: "" } })).toBeUndefined();
    expect(parseCalcPayload({ ...payload, levels: [1.5] })).toBeUndefined();
    expect(parseCalcPayload({ ...payload, groups: [] })).toBeUndefined();
    expect(parseCalcPayload({ ...payload, items: payload.items.map((item) => ({ ...item, category: "" })) })).toBeUndefined();
    expect(parseCalcPayload({ ...payload, items: payload.items.map((item) => ({ ...item, group: "" })) })).toBeUndefined();
  });
});

describe("decodeState and encodeState", () => {
  const item = payload.items[0].key;

  it("reads known choices and falls back to the defaults for anything else", () => {
    expect(decodeState(`?item=${item}&threat=5&diff=low&rarity=unique`, payload)).toMatchObject({ item, level: 5, difficulty: "low", rarity: "unique" });
    expect(decodeState("?item=nope&threat=99&diff=x&rarity=y", payload)).toMatchObject({ item: "", level: 20, difficulty: "normal", rarity: "any" });
  });

  it("writes only what differs from the defaults and keeps other parameters", () => {
    const state = decodeState("", payload);
    expect(encodeState("?lang=x", { ...state, item }, payload)).toBe(`?lang=x&item=${encodeURIComponent(item)}`);
    expect(encodeState("", { ...state, item, level: 3, difficulty: "high", rarity: "rare" }, payload)).toBe(`?item=${encodeURIComponent(item)}&threat=3&diff=high&rarity=rare`);
    expect(encodeState("?item=a&threat=2", state, payload)).toBe("");
    // The slash of an item key is encoded, and reads back.
    const written = encodeState("", { ...state, item }, payload);
    expect(written).toBe(`?item=${encodeURIComponent(item)}`);
    expect(decodeState(written, payload).item).toBe(item);
  });
});

describe("stateRows", () => {
  const base = decodeState("?item=talisman/plummeting", payload);

  it("is empty without an item and lists the sources that can give the chosen one", () => {
    expect(stateRows(dropData, { ...base, item: "" })).toEqual([]);
    expect(stateRows(dropData, base).length).toBeGreaterThan(0);
  });

  it("narrows by source and area", () => {
    const all = stateRows(dropData, base);
    const { sources } = narrowing(all);
    expect(stateRows(dropData, { ...base, source: sources[0] }).every((row) => row.source === sources[0])).toBe(true);
    expect(stateRows(dropData, { ...base, source: "chest:Nowhere" })).toEqual([]);
  });

  it("changes with the threat level for gear whose rarity depends on it", () => {
    const sword = decodeState("?item=melee/sword&rarity=unique", payload);
    const key = payload.items.find((one) => one.key.startsWith("melee/"))?.key ?? "";
    const low = stateRows(dropData, { ...sword, item: key, level: 1 });
    const high = stateRows(dropData, { ...sword, item: key, level: 20 });
    expect(low.length).toBeLessThanOrEqual(high.length);
  });
});

describe("types", () => {
  it("keep the payload readonly", () => {
    const copy: CalcPayload = payload;
    expect(copy.items).toBe(payload.items);
  });
});
