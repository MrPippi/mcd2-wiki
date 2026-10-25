import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import mobsData from "../../../src/data/mobs.json";
import questsData from "../../../src/data/quests.json";
import { GameUpdatesSchema, changeText, dataChangesFor, dataStatus, gameUpdates, updateAnchor, updateDate, type GameUpdate } from "../../../src/lib/game-updates";

const PAGES = "src/pages/[lang]";
/** Slugs of the pages generated from data, by first path segment. */
const DYNAMIC: Readonly<Record<string, ReadonlySet<string>>> = {
  mobs: new Set(mobsData.mobs.map((mob) => mob.slug)),
  quests: new Set(questsData.quests.map((quest) => quest.slug)),
};
const pageExists = (link: string): boolean => {
  const [first = "", second] = link.split("/");
  if (second !== undefined && DYNAMIC[first]) return DYNAMIC[first].has(second);
  return existsSync(`${PAGES}/${link}.astro`) || existsSync(`${PAGES}/${link}/index.astro`);
};

const update = (version: string, date: string, build?: string): GameUpdate => ({
  version, date, ...(build ? { build, label: { zh: "標籤", en: "Label" } } : {}), platforms: ["Steam"], source: "https://example.com/", changes: [{ kind: "fixed", zh: "甲", en: "A" }],
});

describe("game updates", () => {
  it("links every change to a page that exists", () => {
    const links = gameUpdates.flatMap((one) => one.changes.flatMap((change) => (change.link ? [change.link] : [])));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(pageExists(link), link).toBe(true);
  });

  it("rejects updates out of date order or sharing a date", () => {
    expect(GameUpdatesSchema.safeParse([update("1.0", "2026-10-01"), update("1.1", "2026-10-02")]).success).toBe(false);
    expect(GameUpdatesSchema.safeParse([update("1.1", "2026-10-02"), update("1.0", "2026-10-02")]).success).toBe(false);
    expect(GameUpdatesSchema.safeParse([update("1.1", "2026-10-02"), update("1.0", "2026-10-01")]).success).toBe(true);
  });

  it("gives every update a unique anchor, with the build for a version shipped twice", () => {
    const anchors = gameUpdates.map(updateAnchor);
    expect(new Set(anchors).size).toBe(anchors.length);
    expect(updateAnchor(update("1.1.1.0", "2026-10-01", "52099637"))).toBe("v1.1.1.0-52099637");
  });

  it("needs a label for an update with a build, since the page shows the label instead of the number", () => {
    const { label: _label, ...unlabelled } = update("1.1.1.0", "2026-10-01", "52099637");
    expect(GameUpdatesSchema.safeParse([unlabelled]).success).toBe(false);
    expect(GameUpdatesSchema.safeParse([update("1.1.1.0", "2026-10-01", "52099637")]).success).toBe(true);
  });

  it("marks the newest update of the site's version as current and later ones as ahead", () => {
    const list = [update("1.3", "2026-10-22"), update("1.2", "2026-10-07"), update("1.1", "2026-10-01", "2"), update("1.1", "2026-09-29", "1")];
    expect(list.map((one) => dataStatus(list, one, "1.2"))).toEqual(["ahead", "current", undefined, undefined]);
    expect(list.map((one) => dataStatus(list, one, "1.1"))).toEqual(["ahead", "ahead", "current", undefined]);
    expect(list.map((one) => dataStatus(list, one, "9.9"))).toEqual([undefined, undefined, undefined, undefined]);
  });

  it("finds the data changes recorded into an update's version", () => {
    const groups = [{ source: "weapons" as const, entities: [{ slug: "axe", name: { en: "Axe" } as never, status: "changed" as const, fields: [] }] }];
    const changes = [{ from: "1.2", to: "1.3", groups }, { from: "1.1", to: "1.2", groups: [] }];
    expect(dataChangesFor(update("1.3", "2026-10-22"), changes)?.from).toBe("1.2");
    // A comparison that found nothing is still recorded, so the page can say so.
    expect(dataChangesFor(update("1.2", "2026-10-07"), changes)?.groups).toEqual([]);
    expect(dataChangesFor(update("1.1", "2026-10-01"), changes)).toBeUndefined();
  });

  it("shows Traditional Chinese on the zh site and English everywhere else", () => {
    const change = { kind: "fixed", zh: "甲", en: "A" } as const;
    expect(changeText(change, "zh")).toEqual({ text: "甲", lang: "zh" });
    expect(changeText(change, "ja")).toEqual({ text: "A", lang: "en" });
    expect(changeText(change, "zh-hans")).toEqual({ text: "A", lang: "en" });
  });

  it("formats the date in the page language without shifting the day", () => {
    expect(updateDate("2026-10-22", "en")).toBe("October 22, 2026");
    expect(updateDate("2026-10-22", "zh")).toBe("2026年10月22日");
  });
});
