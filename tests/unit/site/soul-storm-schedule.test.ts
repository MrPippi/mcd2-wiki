import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runtimeImports } from "../../helpers/imports";
import {
  formatCountdown, formatWindowTime, parseClockPayload, stormState, upcomingWindows, windowAt, type StormSchedule,
} from "../../../src/lib/soul-storm-schedule";

const ANCHOR = Date.UTC(2026, 0, 1);            // 1767225600000
const MIN = 60_000;
const S: StormSchedule = { anchorMs: ANCHOR, durationMs: 20 * MIN, cadenceMs: 40 * MIN, areaCount: 7, rotationOffset: 0 };
const AREAS = ["Howling Woods", "Singer's Meadow", "Rainy Plains", "Humbler Huskland", "Lullaby Hills", "Frozen Highlands", "Honeycomb Fields"];
const at = (iso: string): number => Date.parse(iso);

describe("windowAt", () => {
  it("places window 0 on the anchor and wraps the rotation every 7 windows", () => {
    expect(windowAt(S, 0)).toEqual({ index: 0, areaIndex: 0, startMs: ANCHOR, endMs: ANCHOR + 20 * MIN });
    expect(windowAt(S, 7).areaIndex).toBe(0);
    expect(windowAt(S, 7).startMs).toBe(at("2026-01-01T04:40:00Z"));
    expect(windowAt(S, -1)).toEqual({ index: -1, areaIndex: 6, startMs: at("2025-12-31T23:20:00Z"), endMs: at("2025-12-31T23:40:00Z") });
  });
  it("applies the rotation offset", () => {
    expect(windowAt({ ...S, rotationOffset: 2 }, 0).areaIndex).toBe(2);
    expect(windowAt({ ...S, rotationOffset: 2 }, 5).areaIndex).toBe(0);
  });
});

describe("stormState at the edges of a window", () => {
  it("is active from the first millisecond", () => {
    expect(stormState(S, ANCHOR)).toEqual({ active: true, window: windowAt(S, 0), msLeft: 20 * MIN });
  });
  it("is still active one second before the end", () => {
    expect(stormState(S, ANCHOR + 20 * MIN - 1000)).toMatchObject({ active: true, msLeft: 1000 });
  });
  it("is over exactly at the end, and points at the next window", () => {
    expect(stormState(S, ANCHOR + 20 * MIN)).toEqual({ active: false, window: windowAt(S, 1), msLeft: 20 * MIN });
  });
  it("counts the last millisecond before the next start", () => {
    expect(stormState(S, ANCHOR + 40 * MIN - 1)).toMatchObject({ active: false, msLeft: 1, window: { index: 1, areaIndex: 1 } });
  });
  it("starts the next storm in the next area", () => {
    expect(stormState(S, ANCHOR + 40 * MIN)).toMatchObject({ active: true, window: { index: 1, areaIndex: 1 } });
  });
  it("handles a time before the anchor", () => {
    expect(stormState(S, ANCHOR - 1000)).toEqual({ active: false, window: windowAt(S, 0), msLeft: 1000 });
  });
});

describe("stormState on real dates", () => {
  it("2026-10-11 00:00 UTC is window 10188, Humbler Huskland, 20 minutes left", () => {
    const state = stormState(S, at("2026-10-11T00:00:00Z"));
    expect(state).toMatchObject({ active: true, msLeft: 20 * MIN, window: { index: 10188, areaIndex: 3 } });
    expect(AREAS[state.window.areaIndex]).toBe("Humbler Huskland");
  });
  it("2026-10-11 00:25 UTC waits 15 minutes for Lullaby Hills", () => {
    const state = stormState(S, at("2026-10-11T00:25:00Z"));
    expect(state).toMatchObject({ active: false, msLeft: 15 * MIN, window: { index: 10189, areaIndex: 4, startMs: at("2026-10-11T00:40:00Z") } });
    expect(AREAS[state.window.areaIndex]).toBe("Lullaby Hills");
  });
  it("moves one area along per day (36 windows a day, 36 mod 7 = 1)", () => {
    expect(stormState(S, at("2026-10-12T00:00:00Z")).window.areaIndex).toBe(4);
  });
});

describe("upcomingWindows", () => {
  it("starts with the running storm", () => {
    expect(upcomingWindows(S, ANCHOR, 3).map((w) => w.index)).toEqual([0, 1, 2]);
  });
  it("starts with the next storm between storms", () => {
    expect(upcomingWindows(S, ANCHOR + 20 * MIN, 3).map((w) => w.index)).toEqual([1, 2, 3]);
  });
  it("covers a full rotation with seven windows", () => {
    expect(new Set(upcomingWindows(S, ANCHOR, 7).map((w) => w.areaIndex)).size).toBe(7);
  });
  it("returns nothing for a count below one", () => {
    expect(upcomingWindows(S, ANCHOR, 0)).toEqual([]);
    expect(upcomingWindows(S, ANCHOR, -2)).toEqual([]);
  });
});

describe("formatCountdown", () => {
  it("rounds up to the second and grows an hour field when needed", () => {
    expect(formatCountdown(20 * MIN)).toBe("20:00");
    expect(formatCountdown(20 * MIN - 1)).toBe("20:00");
    expect(formatCountdown(1000)).toBe("0:01");
    expect(formatCountdown(1)).toBe("0:01");
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(-5)).toBe("0:00");
    expect(formatCountdown(60 * MIN)).toBe("1:00:00");
  });
});

describe("formatWindowTime in the viewer's time zone", () => {
  const start = at("2026-10-11T00:00:00Z");
  it("shows Taipei time", () => {
    expect(formatWindowTime(start, "zh-TW", "Asia/Taipei")).toContain("08:00");
  });
  it("shows New York time, a day earlier", () => {
    const text = formatWindowTime(start, "en-US", "America/New_York");
    expect(text).toContain("20:00");
    expect(text).toMatch(/Sat/);   // 2026-10-10 is a Saturday
  });
  it("follows daylight saving: two windows 40 minutes apart read 01:20 then 01:00 on 2026-11-01 in New York", () => {
    const before = windowAt(S, Math.floor((at("2026-11-01T05:20:00Z") - ANCHOR) / S.cadenceMs));
    expect(before.startMs).toBe(at("2026-11-01T05:20:00Z"));
    expect(formatWindowTime(before.startMs, "en-US", "America/New_York")).toContain("01:20");
    expect(formatWindowTime(before.startMs + S.cadenceMs, "en-US", "America/New_York")).toContain("01:00");
  });
  it("falls back to the runtime time zone when none is given", () => {
    expect(formatWindowTime(start, "en-US")).toMatch(/\d{2}:\d{2}/);
  });
});

describe("parseClockPayload", () => {
  const good = {
    ...S, upcoming: 7,
    areas: AREAS.map((name) => ({ name, href: "/en/map/" })),
    labels: { now: "Now: {area}", next: "Next: {area}", endsIn: "{time} left", startsIn: "starts in {time}", timeZone: "Times are in your time zone: {zone}" },
  };
  it("accepts the page's payload", () => {
    expect(parseClockPayload(JSON.parse(JSON.stringify(good)))).toEqual(good);
  });
  it("keeps an area's icon when it has one", () => {
    const withIcon = { ...good, areas: good.areas.map((area, index) => (index === 0 ? { ...area, icon: "/icons/locations/a.png" } : area)) };
    expect(parseClockPayload(JSON.parse(JSON.stringify(withIcon)))?.areas[0]?.icon).toBe("/icons/locations/a.png");
  });
  it("rejects anything malformed instead of throwing", () => {
    for (const bad of [null, "x", { ...good, areaCount: 0 }, { ...good, areas: good.areas.slice(1) }, { ...good, cadenceMs: good.durationMs }, { ...good, labels: { ...good.labels, now: 1 } }]) {
      expect(parseClockPayload(bad)).toBeUndefined();
    }
  });
  it("rejects bad areas, non-numeric fields, missing labels and a bad upcoming count", () => {
    const bads = [
      { ...good, areas: "x" },
      { ...good, areas: [...good.areas.slice(1), { name: "x", href: 3 }] },
      { ...good, areas: [...good.areas.slice(1), null] },
      { ...good, areas: [...good.areas.slice(1), { name: "x", href: "/", icon: 3 }] },
      { ...good, anchorMs: "0" },
      { ...good, durationMs: Number.NaN },
      { ...good, rotationOffset: Number.POSITIVE_INFINITY },
      { ...good, upcoming: "7" },
      { ...good, labels: null },
      { ...good, labels: { ...good.labels, timeZone: undefined } },
    ];
    for (const bad of bads) expect(parseClockPayload(bad)).toBeUndefined();
  });
});

describe("the module itself", () => {
  it("imports nothing, so the browser bundle stays small", () => {
    const source = readFileSync(path.resolve(__dirname, "../../../src/lib/soul-storm-schedule.ts"), "utf8");
    expect(runtimeImports(source)).toEqual([]);
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});
