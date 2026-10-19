import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import SoulStormPage from "../../../src/pages/[lang]/soul-storm.astro";
import { soulStormData } from "../../../src/lib/soul-storm";
import type { SoulStormData } from "../../../shared/soul-storm-schema";

let container: AstroContainer;
beforeAll(async () => { container = await AstroContainer.create(); });
const render = (lang: string, data: SoulStormData = soulStormData) => container.renderToString(SoulStormPage, { props: { lang, data }, params: { lang } });
const count = (html: string, needle: string): number => html.split(needle).length - 1;

describe("Soul Storm page", () => {
  it("no longer warns that the times are estimated", async () => {
    const html = await render("zh");
    expect(html).not.toContain('data-testid="soul-storm-unverified"');
    expect(html).not.toContain("推算時刻");
  });
  it("gives every rotation area its location icon", async () => {
    const html = await render("en");
    const rotation = html.slice(html.indexOf('data-testid="soul-storm-rotation"'));
    expect(count(rotation.slice(0, rotation.indexOf("</ol>")), 'class="location-icon"')).toBe(7);
  });
  it("says each storm needs 3 generators destroyed", async () => {
    expect(await render("zh")).toContain("每場靈魂風暴需摧毀 3 座風暴產生器（遊戲內觀察）");
    expect(await render("en")).toContain("Each Soul Storm requires destroying 3 Storm Generators (observed in game)");
  });
  it("keeps the schedule readable without JavaScript", async () => {
    const html = await render("en");
    expect(/<[^>]*data-testid="soul-storm-clock"[^>]*>/.exec(html)?.[0]).toMatch(/\shidden(\s|=|>)/);   // attribute order is not fixed
    expect(html).toContain("A storm starts every 40 minutes and lasts 20 minutes");
    expect(count(html, 'href="/en/map/?world=')).toBeGreaterThanOrEqual(7);
  });
  it("never shows the stale tutorial paragraph", async () => {
    for (const lang of ["zh", "en", "ja", "ru"]) expect(await render(lang)).not.toMatch(/every hour|每小時|毎時間|каждый час/);   // the stale paragraph's own words; the cadence line legitimately says "40"
  });
  it("says the gear has no item list and marks each chest group unconfirmed once", async () => {
    const html = await render("en");
    expect(count(html, 'data-testid="soul-storm-unconfirmed"')).toBe(2);
    expect(html).toContain("The data has no item list for this.");
    expect(html).toContain("In Soul Storms, items have a chance to drop with an extra effect!");
  });
  it("shows one untranslated marker for the rotation, not one per area", async () => {
    const fallback = { ...soulStormData, rotationUntranslated: ["ja" as const] };
    const html = await render("ja", fallback);
    const rotation = html.slice(html.indexOf('data-testid="soul-storm-rotation"'));
    expect(count(rotation.slice(0, rotation.indexOf("</ol>") + 400), "tag warn")).toBe(1);
  });
  it("shows the official objective with its placeholder in the generator section", async () => {
    const html = await render("en");
    const generators = html.slice(html.indexOf('data-testid="soul-storm-generators"'));
    expect(generators).toContain('data-slot="0"');
    expect(generators).toContain("Storm Generators to quell");
  });
  it("says how many mobs each final wave summons", async () => {
    const html = await render("en");
    expect(html).toContain("At 20% health, summons 1–2 of");
    expect(html).toContain("At 40% health, summons 1 of");
  });
  it("shows a dash for a missing spawn weight and no multiplier line without multipliers", async () => {
    const generators = soulStormData.generators.map((generator) => ({ ...generator, spawnWeight: null, healthByPlayers: [] }));
    const html = await render("en", { ...soulStormData, generators });
    const section = html.slice(html.indexOf('data-testid="soul-storm-generators"'), html.indexOf('data-testid="soul-storm-chests"'));
    expect(count(section, "<td>—</td>")).toBe(3);
    expect(section).not.toContain("Health with 1–4 players");
  });
  it("puts the English alt title inside the searchable body", async () => {
    const html = await render("ja");
    const body = html.slice(html.indexOf("data-pagefind-body"));
    expect(body).toMatch(/class="catalog-alt[^"]*"[^>]*>Soul Storms</);
  });
  it("says the chest rarity once, after both chest groups, in the page language's numbers", async () => {
    const html = await render("de");
    const chests = html.slice(html.indexOf('data-testid="soul-storm-chests"'));
    expect(count(html, 'data-testid="soul-storm-rarity"')).toBe(1);
    const fromLastGroup = chests.slice(chests.lastIndexOf('<div class="soul-storm-chest-group"'), chests.indexOf('data-testid="soul-storm-rarity"'));
    expect(count(fromLastGroup, "<div")).toBe(count(fromLastGroup, "</div>"));   // every div of the last group is closed: the note sits outside it
    expect(chests).toContain("×0,01");
  });
  it("lets keyboard users scroll every wide table", async () => {
    const html = await render("en");
    const scrolls = html.match(/<div[^>]*class="soul-storm-scroll"[^>]*>/g) ?? [];
    expect(scrolls).toHaveLength(4);   // upcoming storms, generators, two chest groups
    for (const tag of scrolls) {
      expect(tag).toContain('tabindex="0"');
      expect(tag).toContain('role="region"');
      expect(tag).toMatch(/aria-label="[^"]+"/);
    }
    expect(html).toContain('aria-label="Upcoming storms"');
    expect(html).toContain('aria-label="Storm Generator"');
    expect(html).toContain('aria-label="For quelling the storm"');
  });
  it("leaves out the unlock section when the data has none", async () => {
    expect(await render("en", { ...soulStormData, unlock: null })).not.toContain('data-testid="soul-storm-unlock"');
  });
  it("shows only the introduction and a no-data line when there is no schedule", async () => {
    const html = await render("en", { ...soulStormData, rotation: [], generators: [], chests: [] });
    expect(html).toContain("There is no schedule data yet.");
    expect(html).not.toContain('data-testid="soul-storm-clock"');
  });
});
