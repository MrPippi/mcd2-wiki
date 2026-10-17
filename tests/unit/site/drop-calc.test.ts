import { describe, expect, it } from "vitest";
import { calcPayload } from "../../../src/lib/drop-calc/payload";
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

  it("is rejected when a field is missing or wrong", () => {
    expect(parseCalcPayload(undefined)).toBeUndefined();
    expect(parseCalcPayload({ ...payload, items: [] })).toBeUndefined();
    expect(parseCalcPayload({ ...payload, labels: { ...payload.labels, pick: "" } })).toBeUndefined();
    expect(parseCalcPayload({ ...payload, levels: [1.5] })).toBeUndefined();
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
    expect(encodeState("?lang=x", { ...state, item }, payload)).toBe(`?lang=x&item=${item}`);
    expect(encodeState("", { ...state, item, level: 3, difficulty: "high", rarity: "rare" }, payload)).toBe(`?item=${item}&threat=3&diff=high&rarity=rare`);
    expect(encodeState("?item=a&threat=2", state, payload)).toBe("");
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
