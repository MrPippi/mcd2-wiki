import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import SoulStormPage from "../../../src/pages/[lang]/soul-storm.astro";
import { soulStormData } from "../../../src/lib/soul-storm";
import type { SoulStormData } from "../../../scripts/extract/soul-storm-schema";

let container: AstroContainer;
beforeAll(async () => { container = await AstroContainer.create(); });
const render = (lang: string, data: SoulStormData = soulStormData) => container.renderToString(SoulStormPage, { props: { lang, data }, params: { lang } });
const count = (html: string, needle: string): number => html.split(needle).length - 1;

describe("Soul Storm page", () => {
  it("warns once that the times are estimated while unverified", async () => {
    const html = await render("zh");
    expect(count(html, 'data-testid="soul-storm-unverified"')).toBe(1);
    expect(html).toContain("推算時刻，尚未經遊戲內確認");
  });
  it("drops the warning once verified", async () => {
    expect(await render("zh", { ...soulStormData, verified: true })).not.toContain('data-testid="soul-storm-unverified"');
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
  it("leaves out the unlock section when the data has none", async () => {
    expect(await render("en", { ...soulStormData, unlock: null })).not.toContain('data-testid="soul-storm-unlock"');
  });
  it("shows only the introduction and a no-data line when there is no schedule", async () => {
    const html = await render("en", { ...soulStormData, rotation: [], generators: [], chests: [] });
    expect(html).toContain("There is no schedule data yet.");
    expect(html).not.toContain('data-testid="soul-storm-clock"');
  });
});
