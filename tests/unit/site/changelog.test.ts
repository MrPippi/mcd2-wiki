import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GRID_CATEGORIES, TABLE_CATEGORIES } from "../../../shared/sections";
import { ChangelogSchema, changeText, changelog, changelogDate } from "../../../src/lib/changelog";

const PAGES = "src/pages/[lang]";
const CATEGORY_SEGMENTS = new Set<string>([...GRID_CATEGORIES, ...TABLE_CATEGORIES, "armor"]);
const pageExists = (link: string): boolean =>
  CATEGORY_SEGMENTS.has(link) || existsSync(`${PAGES}/${link}.astro`) || existsSync(`${PAGES}/${link}/index.astro`);

describe("changelog", () => {
  it("links every change to a page that exists", () => {
    const links = changelog.flatMap((entry) => entry.changes.flatMap((change) => (change.link ? [change.link] : [])));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(pageExists(link), link).toBe(true);
  });

  it("rejects entries out of date order or sharing a date", () => {
    const change = { kind: "new", zh: "甲", en: "A" };
    expect(ChangelogSchema.safeParse([{ date: "2026-10-01", changes: [change] }, { date: "2026-10-02", changes: [change] }]).success).toBe(false);
    expect(ChangelogSchema.safeParse([{ date: "2026-10-02", changes: [change] }, { date: "2026-10-02", changes: [change] }]).success).toBe(false);
    expect(ChangelogSchema.safeParse([{ date: "2026-10-02", changes: [change] }, { date: "2026-10-01", changes: [change] }]).success).toBe(true);
  });

  it("shows Traditional Chinese on the zh site and English everywhere else", () => {
    const change = { kind: "fixed", zh: "甲", en: "A" } as const;
    expect(changeText(change, "zh")).toEqual({ text: "甲", lang: "zh" });
    expect(changeText(change, "en")).toEqual({ text: "A", lang: "en" });
    expect(changeText(change, "ja")).toEqual({ text: "A", lang: "en" });
    expect(changeText(change, "zh-hans")).toEqual({ text: "A", lang: "en" });
  });

  it("formats the date in the page language without shifting the day", () => {
    expect(changelogDate("2026-10-24", "en")).toBe("October 24, 2026");
    expect(changelogDate("2026-10-24", "zh")).toBe("2026年10月24日");
  });
});
