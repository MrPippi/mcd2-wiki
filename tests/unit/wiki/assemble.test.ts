import { describe, expect, it } from "vitest";
import type { Entry } from "../../../scripts/extract/schemas";
import { assembleWeaponEffects, wikiTitle, type WikiPage } from "../../../scripts/wiki/assemble";

const entry = (category: Entry["category"], slug: string, en: string, variant: Entry["variant"] = "normal"): Entry => ({
  id: slug,
  slug,
  category,
  variant,
  release: "base",
  name: { zh: en, en },
  links: {},
});

const ENTRIES: readonly Entry[] = [
  entry("melee", "axe", "Axe"),
  entry("melee", "axe-unique1", "Hunter's Hatchet", "unique"),
  entry("melee", "claws-unique1", "Sculker Claws", "unique"),
  entry("ranged", "bow", "Bow"),
  entry("effect", "critical-edge", "Critical Edge"),
  entry("effect", "fletcher", "Fletcher"),
  entry("enchantment", "gravity-pulse-unique", "Gravity Strike", "unique"),
  entry("enchantment", "clawing-shadow-unique", "Shadowclaw", "unique"),
  entry("enchantment", "shadow-strike-unique", "Shadowclaw", "unique"),
];

const table = (rows: string) => `== Compatible effects ==\n{|\n${rows}|}\n`;
const row = (name: string) => `|-\n| {{MCD2|Effect#${name}|${name}}}\n| text\n| 1%\n| 2%\n| 3%\n`;

const PAGES = new Map<string, WikiPage>([
  ["Dungeons II:Axe", { title: "Dungeons II:Axe", revision: 11, text: table(row("Critical Edge") + row("Mystery")) }],
  [
    "Dungeons II:Hunter's Hatchet",
    {
      title: "Dungeons II:Hunter's Hatchet",
      revision: 12,
      text:
        "== Unique effect ==\nThe fixed effect of x is {{MCD2|Effect#Fletcher|Fletcher}}, which cannot be rerolled.\n: ''By 35%.''\n" +
        table(row("Critical Edge")),
    },
  ],
  [
    "Dungeons II:Sculker Claws",
    { title: "Dungeons II:Sculker Claws", revision: 13, text: "== Unique effect ==\nThe fixed {{MCD2|enchantment}} of x is {{MCD2|Shadowclaw}}, which cannot be rerolled.\n" },
  ],
  ["Dungeons II:Bow", { title: "Dungeons II:Bow", revision: 14, text: "== Usage ==\nShoot.\n" }],
]);

describe("wikiTitle", () => {
  it("names a weapon's page after its English name", () => {
    expect(wikiTitle(ENTRIES[1])).toBe("Dungeons II:Hunter's Hatchet");
  });
});

describe("assembleWeaponEffects", () => {
  const { data, report } = assembleWeaponEffects(ENTRIES, PAGES);

  it("links compatible effects to their entries and keeps the tier values", () => {
    expect(data.weapons.axe).toEqual({
      page: "Dungeons II:Axe",
      revision: 11,
      compatible: [{ effect: "critical-edge", values: ["1%", "2%", "3%"] }],
    });
  });

  it("adds the fixed bonus of unique weapons", () => {
    expect(data.weapons["axe-unique1"]?.fixed).toEqual({ kind: "effect", slug: "fletcher", value: "35%" });
  });

  it("records a page even when the wiki has no effect data for it yet", () => {
    expect(data.weapons.bow).toEqual({ page: "Dungeons II:Bow", revision: 14, compatible: [] });
  });

  it("drops names it cannot match to exactly one entry, and reports them", () => {
    expect(data.weapons["claws-unique1"]?.fixed).toBeUndefined();
    expect(report.unmatched).toEqual(["Axe: effect Mystery", "Sculker Claws: enchantment Shadowclaw (2 matches)"]);
  });

  it("reports weapons without compatible effects and unique weapons without a fixed bonus", () => {
    expect(report.noCompatible).toEqual(["Sculker Claws", "Bow"]);
    expect(report.noFixedBonus).toEqual(["Sculker Claws"]);
    expect(report.missingPages).toEqual([]);
  });

  it("credits the wiki and its licence", () => {
    expect(data.source).toEqual({
      site: "Minecraft Wiki",
      url: "https://minecraft.wiki/",
      license: "CC BY-NC-SA 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/3.0/",
    });
  });
});
