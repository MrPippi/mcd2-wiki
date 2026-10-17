import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import HubPage from "../../../src/pages/[lang]/guides/index.astro";
import EnchantingPage from "../../../src/pages/[lang]/guides/enchanting.astro";
import ProgressionPage from "../../../src/pages/[lang]/guides/progression.astro";
import RarityPage from "../../../src/pages/[lang]/guides/rarity.astro";
import ThreatPage from "../../../src/pages/[lang]/guides/threat.astro";
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
const ALL_PAGES: readonly Page[] = [VendorsPage, EnchantingPage, RarityPage, ThreatPage, SecretPage, ProgressionPage];

describe("guides hub", () => {
  it("lists the six guides with a summary each, linked in the page language", async () => {
    const html = await container.renderToString(HubPage, { props: { lang: "en" }, params: { lang: "en" } });
    expect(count(html, 'data-testid="guide-card"')).toBe(6);
    for (const slug of ["vendors", "enchanting", "rarity", "threat", "secret-talismans", "progression"]) expect(html).toContain(`href="/en/guides/${slug}/"`);
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
  it("appear once on enchanting (cost table) and rarity (drop weights), twice on threat (balance row, assumed Normal), nowhere else", async () => {
    const counts = await Promise.all(ALL_PAGES.map(async (page) => count(await render(page, "en"), UNCONFIRMED)));
    expect(counts).toEqual([0, 1, 1, 2, 0, 0]);
    const enchanting = await render(EnchantingPage, "en");
    const costs = enchanting.slice(enchanting.indexOf('data-testid="guide-enchant-costs"'), enchanting.indexOf('data-testid="guide-enchant-points"'));
    expect(costs).toContain(UNCONFIRMED);
    const rarity = await render(RarityPage, "en");
    expect(rarity.slice(rarity.indexOf('data-testid="guide-rarity-drops"'))).toContain(UNCONFIRMED);
  });

  it("go away once the status file confirms the fact", async () => {
    const verified = { ...guidesData, verified: { enchantCostPerLevel: true, rarityOdds: true, threatBalanceRow: true } };
    expect(await render(EnchantingPage, "en", verified)).not.toContain(UNCONFIRMED);
    expect(await render(RarityPage, "en", verified)).not.toContain(UNCONFIRMED);
    expect(await render(ThreatPage, "en", verified)).not.toContain(UNCONFIRMED);
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

describe("threat guide", () => {
  const section = (html: string, testId: string): string => html.slice(html.indexOf(`data-testid="${testId}"`));

  it("shows the three difficulties with the game's texts and their multipliers", async () => {
    const html = await render(ThreatPage, "en");
    expect(count(html, 'data-testid="guide-difficulty-card"')).toBe(3);
    for (const name of ["Easy", "Normal", "Hard"]) expect(html).toContain(name);
    const low = html.slice(html.indexOf('data-difficulty="low"'), html.indexOf('data-difficulty="normal"'));
    expect(low).toContain("Your attack power ×1.5");
    expect(low).toContain("Your damage resistance ×2");
    expect(low).toContain("Damage dealt");
    expect(html).toContain("For players who prefer a casual play.");
  });

  it("says only the low difficulty drops no Special or Unique items", async () => {
    const html = await render(ThreatPage, "en");
    expect(count(html, 'data-testid="guide-difficulty-drops"')).toBe(1);
    expect(html).toContain("No Special or Unique item drops.");
    expect(html.slice(html.indexOf('data-difficulty="low"'), html.indexOf('data-difficulty="normal"'))).toContain("guide-difficulty-drops");
  });

  it("lists threat 1 to 20 with the tier and rarity factors", async () => {
    const html = await render(ThreatPage, "en");
    expect(count(html, 'data-testid="guide-threat-row"')).toBe(20);
    const rows = [...html.matchAll(/<tr data-testid="guide-threat-row">([\s\S]*?)<\/tr>/g)].map((match) => [...match[1].matchAll(/>([^<]+)</g)].map((cell) => cell[1]));
    expect(rows[0]).toEqual(["1", "0", "×1", "×1", "1", "0", "0", "1", "0.6", "0", "0", "5%–10%", "1,000–4,000", "4,000–8,000"]);
    expect(rows[19]).toEqual(["20", "95", "×0.36", "×0.41", "0", "1", "1", "0.5", "0.5", "1", "1", "40%–65%", "700–2,000", "1,500–5,000"]);
  });

  it("derives the tier notes from the data", async () => {
    const notes = section(await render(ThreatPage, "en"), "guide-tier-notes");
    expect(notes).toContain("Tier II effects appear from threat 3.");
    expect(notes).toContain("Tier III effects appear from threat 6.");
    expect(notes).toContain("From threat 20 on, tier I effects no longer appear.");
  });

  it("uses the game's word for threat and its own texts in Chinese", async () => {
    const html = await render(ThreatPage, "zh");
    expect(html).toContain("威脅");
    expect(html).toContain("簡單");
  });

  it("keeps the header sticky inside a keyboard-scrollable box", async () => {
    const html = await render(ThreatPage, "en");
    expect(html).toContain('class="guide-scroll guide-scroll-tall" tabindex="0" role="region"');
    expect(html).toContain("guide-table-sticky");
    expect(html).toContain('colspan="3"');
  });

  it("gives the table a hidden caption and the empty cells a text", async () => {
    const html = await render(ThreatPage, "en");
    expect(html).toContain('<caption class="sr-only">By threat level</caption>');
    const sparse = guidesData.threat.map((row, index) => (index === 0 ? row : { level: row.level }));
    const gaps = await render(ThreatPage, "en", { ...guidesData, threat: sparse });
    expect(count(gaps, '<span class="sr-only">No data</span>')).toBe(19 * 13);
    expect(gaps).toContain('<span aria-hidden="true">—</span>');
  });

  it("leaves out a section and a column group whose data is missing", async () => {
    const noDifficulty = await render(ThreatPage, "en", { ...guidesData, difficulty: [] });
    expect(noDifficulty).not.toContain('data-testid="guide-difficulty"');
    const bare = guidesData.threat.map(({ level }) => ({ level }));
    const noThreat = await render(ThreatPage, "en", { ...guidesData, threat: [] });
    expect(noThreat).not.toContain('data-testid="guide-threat-table"');
    const levelsOnly = await render(ThreatPage, "en", { ...guidesData, threat: bare });
    expect(count(levelsOnly, 'data-testid="guide-threat-row"')).toBe(20);
    expect(levelsOnly).not.toContain("Effect tier weight factor");
    expect(levelsOnly).not.toContain('data-testid="guide-tier-notes"');
  });

  it("marks the difficulty section when a game text fell back to English", async () => {
    const [first, ...rest] = guidesData.difficulty;
    const data = { ...guidesData, difficulty: [{ ...first, name: { ...first.name, untranslated: ["ja" as const] } }, ...rest] };
    expect(count(section(await render(ThreatPage, "ja", data), "guide-difficulty"), 'data-testid="guide-section-untranslated"')).toBe(1);
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
    expect(section).toContain('data-testid="guide-section-untranslated"');
  });
});

describe("untranslated markers on game text inside site sentences and tables", () => {
  const MARKER = 'data-testid="guide-section-untranslated"';
  const withFallback = (ids: readonly (keyof GuidesData["texts"])[]): GuidesData => ({
    ...guidesData,
    texts: { ...guidesData.texts, ...Object.fromEntries(ids.map((id) => [id, { ...guidesData.texts[id], untranslated: ["ja" as const] }])) },
  });
  const section = (html: string, testId: string): string => {
    const start = html.indexOf(`data-testid="${testId}"`);
    return html.slice(start, html.indexOf("</section>", start));
  };

  it("are absent while every text has its own translation", async () => {
    for (const page of ALL_PAGES) expect(await render(page, "ja")).not.toContain(MARKER);
  });

  it("mark the vendor section once when an unlock text fell back to English", async () => {
    const html = await render(VendorsPage, "ja", withFallback(["merchantLevel2"]));
    expect(count(section(html, "guide-vendors"), MARKER)).toBe(1);
    expect(section(html, "guide-merchant")).not.toContain(MARKER);
  });

  it("mark every section that names the currency when its name fell back to English", async () => {
    const data = withFallback(["echoShards"]);
    const vendors = await render(VendorsPage, "ja", data);
    expect(count(section(vendors, "guide-vendors"), MARKER)).toBe(1);
    expect(count(section(vendors, "guide-merchant"), MARKER)).toBe(1);
    expect(count(section(await render(EnchantingPage, "ja", data), "guide-enchant-costs"), MARKER)).toBe(1);
    expect(count(section(await render(ProgressionPage, "ja", data), "guide-caps"), MARKER)).toBe(1);
  });

  it("mark the Dutch enchanting cost table, whose headers show the English points name", async () => {
    expect(count(section(await render(EnchantingPage, "nl"), "guide-enchant-costs"), MARKER)).toBe(1);
  });

  it("mark Enchantsmith level texts and quest names", async () => {
    const enchanting = await render(EnchantingPage, "ja", withFallback(["enchantsmithLevel3"]));
    expect(count(section(enchanting, "guide-enchantsmith"), MARKER)).toBe(1);
    const talismans = guidesData.secretTalismans.talismans.map((talisman) => ({
      ...talisman, quests: talisman.quests.map((quest) => (quest.name ? { ...quest, name: { ...quest.name, untranslated: ["ja" as const] } } : quest)),
    }));
    const secret = await render(SecretPage, "ja", { ...guidesData, secretTalismans: { ...guidesData.secretTalismans, talismans } });
    expect(count(section(secret, "guide-secret-talismans"), MARKER)).toBe(1);
  });
});

describe("secret talismans intro", () => {
  it("says each sits in its own chest only while every one has a chest", async () => {
    expect(await render(SecretPage, "en")).toContain('data-testid="guide-secret-intro"');
    const [first, ...rest] = guidesData.secretTalismans.talismans;
    const data = { ...guidesData, secretTalismans: { ...guidesData.secretTalismans, talismans: [{ ...first, chest: false }, ...rest] } };
    expect(await render(SecretPage, "en", data)).not.toContain('data-testid="guide-secret-intro"');
  });
});

describe("every guide", () => {
  it("links back to the hub and keeps wide tables keyboard-scrollable", async () => {
    for (const page of ALL_PAGES) {
      const html = await render(page, "ru");
      expect(html).toContain('href="/ru/guides/"');
      const scrolls = html.match(/<div[^>]*class="guide-scroll[^"]*"[^>]*>/g) ?? [];
      if (page !== SecretPage) expect(scrolls.length).toBeGreaterThan(0);   // the talisman page has cards, no tables
      for (const tag of scrolls) {
        expect(tag).toContain('tabindex="0"');
        expect(tag).toMatch(/aria-label="[^"]+"/);
      }
    }
  });
});
