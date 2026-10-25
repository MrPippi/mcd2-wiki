import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import type { Mob } from "../../../shared/mob-schema";
import MobPage from "../../../src/pages/[lang]/mobs/[slug].astro";
import { findMob } from "../../../src/lib/mobs";

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});

const realMob = (slug: string): Mob => {
  const mob = findMob(slug);
  if (!mob) throw new Error(`no mob ${slug} in mobs.json`);
  return mob;
};

const render = (mob: Mob, lang = "zh") => container.renderToString(MobPage, { props: { lang, mob }, params: { lang, slug: mob.slug } });
const count = (html: string, needle: string): number => html.split(needle).length - 1;

describe("mob page", () => {
  it("shows a labelled empty frame for a mob without a portrait", async () => {
    // Every real bestiary mob has a portrait now, so the frame is checked on a fixture.
    const { portrait: _portrait, ...noPortrait } = realMob("zombie");
    const html = await render(noPortrait as Mob, "en");
    expect(html).toContain('data-testid="mob-portrait-placeholder"');
    expect(html).toContain('aria-label="No portrait yet"');
    const plate = html.slice(html.indexOf('class="entry-head specimen-plate mob-plate"'), html.indexOf("</aside>"));
    expect(plate).not.toContain("<img");
  });

  it("marks an untranslated name once, next to the title", async () => {
    const fixture: Mob = { ...realMob("zombie"), untranslated: ["zh"] };
    const html = await render(fixture);
    expect(count(html, '<span class="tag warn"')).toBe(1);
    expect(html).toMatch(/class="mob-title"[^]*?class="tag warn"/);
  });

  it("shows no untranslated marker when the name is translated", async () => {
    expect(count(await render(realMob("zombie")), "tag warn")).toBe(0);
  });

  it("leaves out the drops section for a mob without drops, but keeps the game-data note", async () => {
    const html = await render({ ...realMob("piggy-bank"), drops: [] });   // every real bestiary mob drops something
    expect(html).not.toContain('data-testid="mob-drops"');
    expect(count(html, 'data-testid="mob-drops-note"')).toBe(1);
  });

  it("leaves out the Soul Corrupted drops when that version has none", async () => {
    const zombie = realMob("zombie");
    const soulCorrupted = zombie.soulCorrupted;
    if (!soulCorrupted) throw new Error("zombie has no Soul Corrupted version");
    const html = await render({ ...zombie, soulCorrupted: { ...soulCorrupted, drops: [] } });
    expect(html).toContain('data-testid="mob-soul-corrupted"');
    expect(html).not.toContain('data-testid="mob-drops-soul"');
  });

  it("gives every test id on the page once, the Soul Corrupted section its own", async () => {
    const html = await render(realMob("zombie"));
    const ids = [...html.matchAll(/data-testid="([^"]+)"/g)].map((match) => match[1]);
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
    expect(ids).toEqual(expect.arrayContaining(["mob-stats", "mob-drops", "mob-stats-soul", "mob-drops-soul"]));
  });

  it("describes the mob in its own meta description", async () => {
    const html = await render(realMob("zombie"));
    expect(html).toContain('<meta name="description" content="殭屍 · 一般怪物 · 怪物圖鑑 · Minecraft Dungeons II"');
  });
});
