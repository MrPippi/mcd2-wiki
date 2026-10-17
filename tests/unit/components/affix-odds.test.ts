import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import type { Category } from "../../../scripts/extract/config";
import AffixOdds from "../../../src/components/AffixOdds.astro";
import { findEntry } from "../../../src/lib/data";

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});

const render = async (lang: string, category: Category, slug: string): Promise<string> => {
  const item = findEntry(category, slug);
  if (!item) throw new Error(`no ${category}/${slug}`);
  return container.renderToString(AffixOdds, { props: { lang, item } });
};

/** The cells of one effect's row, in column order. */
const cells = (html: string, effect: string): string[] => {
  const row = html.match(new RegExp(`<tr data-effect="${effect}"[^]*?</tr>`))?.[0] ?? "";
  return [...row.matchAll(/<td[^>]*data-cell="[^"]*"[^>]*>([^<]*)<\/td>/g)].map((match) => match[1]);
};

describe("effect odds table", () => {
  it.each([
    ["melee", "war-hammer"],
    ["ranged", "bow"],
    ["armor", "mushroom-helmet"],
    ["artifact", "firework-quiver"],
  ] as const)("renders for %s %s, in English and Traditional Chinese", async (category, slug) => {
    for (const lang of ["en", "zh"]) {
      const html = await render(lang, category, slug);
      expect(html).toContain('data-testid="affix-odds"');
      expect(html).toContain('data-testid="affix-table"');
      expect(html.match(/<tr data-effect=/g)?.length).toBeGreaterThan(3);
    }
  });

  it("prints the default threat 20 values without scripts", async () => {
    const html = await render("en", "melee", "war-hammer");
    expect(cells(html, "critical-edge")).toEqual(["0%", "6.20%", "6.20%", "12.40%"]);
    expect(html).toMatch(/Threat level <b data-affix-level-text>20<\/b>/);
    expect(html).toMatch(/Random effects <b data-affix-slots-text>1<\/b>/);
    expect(html).toContain("Effect odds");
  });

  it("starts with the controls hidden and offers every threat level, rarity and the Soul Storm bonus", async () => {
    const html = await render("en", "melee", "war-hammer");
    expect(html).toMatch(/data-affix-controls hidden/);
    expect(html.match(/<option value="\d+"/g)).toHaveLength(20);
    expect(html).toMatch(/<option value="rare" selected>Rare<\/option>\s*<option value="special">Special<\/option>/);
    expect(html).toContain("data-affix-bonus");
  });

  it("offers a unique piece only its Unique rarity, and shows its built-in effect at 100%", async () => {
    const html = await render("en", "armor", "frost-rime-chest-unique");
    expect(html).not.toContain("data-affix-rarity>");
    expect(html).toContain('<span data-affix-rarity-text>Unique</span>');
    expect(html).toMatch(/<tr data-effect="elemental-protection" class="affix-fixed">/);
    expect(cells(html, "elemental-protection").at(-1)).toBe("100%");
    expect(html).toContain("Built-in");
  });

  it("states what the numbers are and flags them unconfirmed", async () => {
    const html = await render("zh", "artifact", "firework-quiver");
    expect(html).toContain("這不是掉落機率");
    expect(html).toContain('data-testid="guide-unconfirmed"');
    expect(html).toContain("威脅等級");
  });

  it("announces changes politely, labels its controls with their own string and keeps the table in a scrollable region", async () => {
    const html = await render("en", "melee", "war-hammer");
    expect(html).toMatch(/<p class="affix-summary"[^>]*aria-live="polite"/);
    expect(html).toContain('aria-label="Odds settings"');
    expect(html).toMatch(/<div class="table-scroll" tabindex="0" role="region"[^>]*>\s*<table class="affix-table"/);
    expect(html).toMatch(/<thead>/);
  });

  it("renders nothing for other categories", async () => {
    expect(await render("en", "effect", "sharpness")).not.toContain('data-testid="affix-odds"');
  });
});
