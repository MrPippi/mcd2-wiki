import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import HubPage from "../../../src/pages/[lang]/guides/index.astro";
import EnchantingPage from "../../../src/pages/[lang]/guides/enchanting.astro";
import ProgressionPage from "../../../src/pages/[lang]/guides/progression.astro";
import RarityPage from "../../../src/pages/[lang]/guides/rarity.astro";
import SecretPage from "../../../src/pages/[lang]/guides/secret-talismans.astro";
import VendorsPage from "../../../src/pages/[lang]/guides/vendors.astro";
import { guidesData } from "../../../src/lib/guides";
import type { GuidesData } from "../../../scripts/extract/guides-schema";

let container: AstroContainer;
beforeAll(async () => { container = await AstroContainer.create(); });

type Page = typeof VendorsPage;
const render = (page: Page, lang: string, data: GuidesData = guidesData) => container.renderToString(page, { props: { lang, data }, params: { lang } });
const count = (html: string, needle: string): number => html.split(needle).length - 1;
const UNCONFIRMED = 'data-testid="guide-unconfirmed"';
const ALL_PAGES: readonly Page[] = [VendorsPage, EnchantingPage, RarityPage, SecretPage, ProgressionPage];

describe("guides hub", () => {
  it("lists the five guides with a summary each, linked in the page language", async () => {
    const html = await container.renderToString(HubPage, { props: { lang: "en" }, params: { lang: "en" } });
    expect(count(html, 'data-testid="guide-card"')).toBe(5);
    for (const slug of ["vendors", "enchanting", "rarity", "secret-talismans", "progression"]) expect(html).toContain(`href="/en/guides/${slug}/"`);
    expect(html).toContain("What it costs to level up the Town Merchant, Blacksmith and Enchantsmith");
  });
});

describe("vendors guide", () => {
  it("shows the three vendors by their game names with their upgrade costs", async () => {
    const html = await render(VendorsPage, "en");
    expect(count(html, 'data-testid="guide-vendor"')).toBe(3);
    for (const name of ["Town Merchant", "Blacksmith", "Enchantsmith"]) expect(html).toContain(name);
    const costs = [...html.matchAll(/data-testid="guide-vendor-level"[^>]*>\s*<th[^>]*>(\d)<\/th>\s*<td[^>]*>(\d+)<\/td>/g)].map((match) => `${match[1]}:${match[2]}`);
    expect(costs).toEqual(["2:10", "3:15", "2:20", "3:40", "2:30", "3:60"]);
    expect(html).toContain("You&#39;ll unlock rare item purchases");
    expect(html).toContain("Upgrades are paid in Echo Shards.");
  });

  it("states the merchant facts and the Echo Shard cap", async () => {
    const html = await render(VendorsPage, "en");
    expect(html).toContain("Items on sale per rarity: 3");
    expect(html).toContain("Refreshing the stock right away: 3 Echo Shards");
    expect(html).toContain("You can carry at most 100 Echo Shards.");
    expect(count(html.slice(html.indexOf('data-testid="guide-base-prices"')), "<td class=\"guide-number\">20</td>")).toBe(7);
    expect(html).toContain("×4");
    expect(html).not.toMatch(/SpringStone/i);
  });

  it("uses the game's own names in Chinese", async () => {
    const html = await render(VendorsPage, "zh");
    expect(html).toContain("城鎮商人");
    expect(html).toContain("回聲碎片");
  });

  it("leaves out the merchant section without merchant data", async () => {
    expect(await render(VendorsPage, "en", { ...guidesData, merchant: null })).not.toContain('data-testid="guide-merchant"');
  });
});

describe("unconfirmed tags", () => {
  it("appear once on enchanting (cost table) and once on rarity (drop weights), nowhere else", async () => {
    const counts = await Promise.all(ALL_PAGES.map(async (page) => count(await render(page, "en"), UNCONFIRMED)));
    expect(counts).toEqual([0, 1, 1, 0, 0]);
    const enchanting = await render(EnchantingPage, "en");
    const costs = enchanting.slice(enchanting.indexOf('data-testid="guide-enchant-costs"'), enchanting.indexOf('data-testid="guide-enchant-points"'));
    expect(costs).toContain(UNCONFIRMED);
    const rarity = await render(RarityPage, "en");
    expect(rarity.slice(rarity.indexOf('data-testid="guide-rarity-drops"'))).toContain(UNCONFIRMED);
  });

  it("go away once the status file confirms the fact", async () => {
    const verified = { ...guidesData, verified: { enchantCostPerLevel: true, rarityOdds: true } };
    expect(await render(EnchantingPage, "en", verified)).not.toContain(UNCONFIRMED);
    expect(await render(RarityPage, "en", verified)).not.toContain(UNCONFIRMED);
  });
});

describe("enchanting guide", () => {
  it("shows the cost table, the official tutorial texts and the highest level", async () => {
    const html = await render(EnchantingPage, "en");
    expect(html).toContain("Enchantment points, added per level");
    expect(html).toContain("You earn one enchantment point each time you level up");
    expect(html).toContain("Enchantments go up to level III.");
    expect(html).toContain("You&#39;ll unlock upgrading enchantments to level III");
  });

  it("marks the Dutch enchantment points title untranslated", async () => {
    const html = await render(EnchantingPage, "nl");
    const section = html.slice(html.indexOf('data-testid="guide-enchant-points"'));
    expect(section.slice(0, 600)).toContain("tag warn");
  });
});

describe("rarity guide", () => {
  it("shows effects, offsets and both drop rows with shares", async () => {
    const html = await render(RarityPage, "en");
    expect(count(html, 'data-testid="guide-drop-row"')).toBe(2);
    expect(html).toContain("50%");
    expect(html).toContain("×0");
    expect(html).toContain("16.7%");
    expect(html).toContain("Extra effects on Soul Storm rewards");
  });
});

describe("secret talismans guide", () => {
  it("links each secret talisman to its page and names the one quest that hands one out", async () => {
    const html = await render(SecretPage, "en");
    expect(count(html, 'data-testid="guide-talisman"')).toBe(8);
    expect(count(html, 'data-testid="guide-talisman-chest"')).toBe(8);
    expect(html).toContain('href="/en/talisman/double-drop/"');
    expect(count(html, 'data-testid="guide-talisman-quests"')).toBe(1);
    expect(html).toContain("The Prime Enchanter Revived");
    expect(html).toContain("Quest CA04_BR (no name in the game text)");
    expect(html).toContain("A secret door has opened in the world.");
  });
});

describe("progression guide", () => {
  it("shows the caps, the Echo Shard sources and the stage levels", async () => {
    const html = await render(ProgressionPage, "de");
    expect(count(html, 'data-testid="guide-cap"')).toBe(3);
    expect(html).toContain("99.999");
    expect(count(html, 'data-testid="guide-stage"')).toBe(guidesData.stages.length);
    expect(html).toContain("Echoscherben");
  });

  it("marks the stage table once when a name fell back to English", async () => {
    const stages = guidesData.stages.map((stage) => ({ ...stage, name: { ...stage.name, untranslated: ["ja" as const] } }));
    const html = await render(ProgressionPage, "ja", { ...guidesData, stages });
    const section = html.slice(html.indexOf('data-testid="guide-stages"'));
    expect(count(section, "tag warn")).toBe(1);
  });
});

describe("every guide", () => {
  it("links back to the hub and keeps wide tables keyboard-scrollable", async () => {
    for (const page of ALL_PAGES) {
      const html = await render(page, "ru");
      expect(html).toContain('href="/ru/guides/"');
      for (const tag of html.match(/<div[^>]*class="guide-scroll"[^>]*>/g) ?? []) {
        expect(tag).toContain('tabindex="0"');
        expect(tag).toMatch(/aria-label="[^"]+"/);
      }
    }
  });
});
