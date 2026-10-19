import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { breadcrumbTrail } from "../../../src/lib/breadcrumbs";
import { llmsTxt } from "../../../src/lib/llms";
import { ALL_LANGS } from "../../../scripts/extract/config";
import { t } from "../../../src/lib/i18n";
import { LLMS_SECTIONS, PAGE_SECTIONS, SITE_MENU, TABLE_CATEGORIES, pageSection, sectionTitle } from "../../../src/lib/sections";
import { TAB_ORDER } from "../../../src/lib/tabs";
import { entryHref } from "../../../src/lib/url";

const PAGES_DIR = resolve(__dirname, "../../../src/pages/[lang]");
const pageDirs = readdirSync(PAGES_DIR, { withFileTypes: true }).map((entry) => entry.name.replace(/\.astro$/, ""));

describe("PAGE_SECTIONS", () => {
  it("has a route under src/pages/[lang]/ for every section", () => {
    for (const { segment } of PAGE_SECTIONS) expect(pageDirs, segment).toContain(segment);
  });

  it("names every section with a UI string in every language", () => {
    for (const section of PAGE_SECTIONS) {
      for (const lang of ALL_LANGS) {
        expect(t(lang, section.key), `${lang}/${section.key}`).not.toBe("");
        expect(t(lang, sectionTitle(section)), `${lang}/${sectionTitle(section)}`).not.toBe("");
        if (section.llms) expect(t(lang, section.llms.intro), `${lang}/${section.llms.intro}`).not.toBe("");
      }
    }
  });

  it("has unique segments and unique llms ranks", () => {
    const segments = PAGE_SECTIONS.map((section) => section.segment);
    expect(new Set(segments).size).toBe(segments.length);
    const ranks = LLMS_SECTIONS.map((section) => section.llms.rank);
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it("does not shadow an item category", () => {
    for (const { segment } of PAGE_SECTIONS) expect(TAB_ORDER as readonly string[]).not.toContain(segment);
  });
});

describe("lists derived from the registry", () => {
  it("builds the hamburger menu in registry order", () => {
    expect(SITE_MENU).toEqual(PAGE_SECTIONS.map(({ key, segment }) => ({ key, segment })));
  });

  it("lists every section but the guides in llms.txt, in rank order", () => {
    expect(LLMS_SECTIONS.map((section) => section.segment)).toEqual(["mobs", "bosses", "locations", "quests", "map", "soul-storm", "achievements", "build", "compare", "drops"]);
    expect(PAGE_SECTIONS.filter((section) => section.llms === undefined).map((section) => section.segment)).toEqual(["guides"]);
    const text = llmsTxt(undefined, "/");
    for (const section of PAGE_SECTIONS) expect(text).toContain(`/en/${section.segment}/`);
    for (const category of TAB_ORDER) expect(text).toContain(`/en/${category}/`);
  });

  it("names a section in the breadcrumbs by its title", () => {
    for (const section of PAGE_SECTIONS) {
      const trail = breadcrumbTrail(`/zh/${section.segment}/x/`, "/", "zh", "X");
      expect(trail[1]?.name).toBe(t("zh", sectionTitle(section)));
    }
    expect(pageSection("map")).toBeDefined();
    expect(pageSection("nope")).toBeUndefined();
  });

  it("anchors table-category entries on their category page", () => {
    for (const category of TABLE_CATEGORIES) {
      const entry = { category, slug: "burning", links: {} } as unknown as Parameters<typeof entryHref>[1];
      expect(entryHref("en", entry)).toMatch(new RegExp(`/en/${category}/#burning$`));
    }
  });
});
