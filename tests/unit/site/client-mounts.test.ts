import { describe, expect, it } from "vitest";
import { cellText, slotCount } from "../../../src/client/affix-odds";
import { groupHidden, matchesFilter } from "../../../src/client/list-filter";
import { isComparePressed, nextCompare, searchOpensOnClick } from "../../../src/client/site-header";
import { clockText } from "../../../src/client/soul-storm-clock";
import type { ClockPayload } from "../../../src/lib/soul-storm-schedule";

describe("list filter", () => {
  it("matches the variant button and the search text together", () => {
    expect(matchesFilter("all", "sword", "normal", "iron sword")).toBe(true);
    expect(matchesFilter("unique", "sword", "normal", "iron sword")).toBe(false);
    expect(matchesFilter("unique", "sword", "unique", "iron sword")).toBe(true);
    expect(matchesFilter("all", "axe", "normal", "iron sword")).toBe(false);
  });

  it("treats a card without names as matching only the empty search", () => {
    expect(matchesFilter("all", "", undefined, undefined)).toBe(true);
    expect(matchesFilter("all", "x", undefined, undefined)).toBe(false);
  });

  it("hides a group only when every card in it is hidden", () => {
    expect(groupHidden([true, true])).toBe(true);
    expect(groupHidden([true, false])).toBe(false);
  });
});

describe("site header", () => {
  it("flips the compare toggle, treating anything but off as on", () => {
    expect(nextCompare("off")).toBe("on");
    expect(nextCompare("on")).toBe("off");
    expect(nextCompare(undefined)).toBe("off");
    expect(isComparePressed("off")).toBe(false);
    expect(isComparePressed(undefined)).toBe(true);
  });

  it("opens the search toggle unless it is already expanded", () => {
    expect(searchOpensOnClick(null)).toBe(true);
    expect(searchOpensOnClick("false")).toBe(true);
    expect(searchOpensOnClick("true")).toBe(false);
  });
});

describe("affix odds table", () => {
  const odds = {
    templates: [{ effect: "crit", tier: 1, probability: 0.25 }],
    effects: [{ effect: "crit", probability: 0.5 }],
  } as unknown as Parameters<typeof cellText>[0];

  it("reads a tier cell from the templates and an any cell from the effects", () => {
    expect(cellText(odds, "crit", "1")).toBe("25.00%");
    expect(cellText(odds, "crit", "any")).toBe("50.00%");
  });

  it("prints 0% for an effect or tier without odds", () => {
    expect(cellText(odds, "crit", "2")).toBe("0%");
    expect(cellText(odds, "haste", "any")).toBe("0%");
  });

  it("counts bonus slots only when the bonus is on", () => {
    expect(slotCount(2, 1, true)).toBe(3);
    expect(slotCount(2, 1, false)).toBe(2);
  });
});

describe("soul storm clock text", () => {
  const MIN = 60_000;
  const payload: ClockPayload = {
    anchorMs: 0,
    durationMs: 20 * MIN,
    cadenceMs: 40 * MIN,
    areaCount: 2,
    rotationOffset: 0,
    upcoming: 3,
    areas: [
      { name: "Woods", href: "/a" },
      { name: "Meadow", href: "/b" },
    ],
    labels: { now: "Now: {area}", next: "Next: {area}", endsIn: "{time} left", startsIn: "starts in {time}", timeZone: "{zone}" },
  };

  it("reports the running storm with its time left", () => {
    const text = clockText(payload, 5 * MIN);
    expect(text.status).toBe("Now: Woods");
    expect(text.countdown).toMatch(/ left$/);
    expect(text.windowIndex).toBe(0);
  });

  it("reports the next storm between windows", () => {
    const text = clockText(payload, 30 * MIN);
    expect(text.status).toBe("Next: Meadow");
    expect(text.countdown).toMatch(/^starts in /);
    expect(text.windowIndex).toBe(1);
  });
});
