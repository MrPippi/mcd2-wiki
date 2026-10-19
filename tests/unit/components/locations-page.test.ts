import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import type { Location } from "../../../shared/location-schema";
import MobAreas from "../../../src/components/MobAreas.astro";
import { bossList, findLocation, locationData } from "../../../src/lib/locations";
import { findMob } from "../../../src/lib/mobs";
import { findQuest } from "../../../src/lib/quests";
import BossesPage from "../../../src/pages/[lang]/bosses.astro";
import LocationPage from "../../../src/pages/[lang]/locations/[slug].astro";
import LocationsIndex from "../../../src/pages/[lang]/locations/index.astro";
import QuestPage from "../../../src/pages/[lang]/quests/[slug].astro";

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});

const count = (html: string, needle: string): number => html.split(needle).length - 1;
const realLocation = (slug: string): Location => {
  const found = findLocation(slug);
  if (!found) throw new Error(`no location ${slug}`);
  return found;
};
const renderList = (lang: string, data = locationData) => container.renderToString(LocationsIndex, { props: { lang, data }, params: { lang } });
const renderLocation = (location: Location, lang = "en") =>
  container.renderToString(LocationPage, { props: { lang, location }, params: { lang, slug: location.slug } });
const renderBosses = (lang = "en", groups = bossList()) => container.renderToString(BossesPage, { props: { lang, groups }, params: { lang } });
/** The HTML from a test id to the end of its element's section. */
const section = (html: string, testid: string): string => {
  const start = html.indexOf(`data-testid="${testid}"`);
  if (start === -1) throw new Error(`no ${testid}`);
  const end = html.indexOf("</section>", start);
  return html.slice(start, end === -1 ? undefined : end);
};
const headings = (html: string): number[] => [...html.matchAll(/<h([1-6])[\s>]/g)].map((match) => Number(match[1]));

describe("location list", () => {
  it("shows one card per location, linked, with icon, level and counts", async () => {
    const html = await renderList("en");
    expect(count(html, 'data-testid="location-card"')).toBe(locationData.locations.length);
    expect(html).toContain('href="/en/locations/howling-woods/"');
    expect(html).toContain('src="/icons/locations/howling-woods.png"');
    expect(html).toMatch(/data-testid="location-card-level">Player level <span class="mono">6<\/span>/);
    expect(html).toMatch(/data-testid="count-bosses">Bosses <span class="mono">4<\/span>/);
  });

  it("gives a location without a game icon an empty mount and one without a level no level line", async () => {
    const only = { ...locationData, locations: [{ ...realLocation("ravines"), icon: undefined }] };
    const html = await renderList("zh", only);
    expect(html).toContain('class="location-icon is-empty"');
    expect(html).not.toContain("location-card-level");
    expect(html).toContain("Ravines");   // the comparison name
  });

  it("marks an untranslated name", async () => {
    const html = await renderList("ja", { ...locationData, locations: [{ ...realLocation("ravines"), untranslated: ["ja"] }] });
    expect(count(html, "tag warn")).toBe(1);
  });
});

describe("location page", () => {
  it("shows the name, comparison name, level and the map link", async () => {
    const html = await renderLocation(realLocation("frozen-highlands"), "zh");
    expect(html).toContain("冰封高地");
    expect(html).toContain("Frozen Highlands");
    expect(html).toMatch(/data-testid="location-level">26</);
    expect(html).toContain('href="/zh/map/?world=overworld#4/6611/4173"');
  });

  it("lists places with a count for folded repeats and marks a place named like its region", async () => {
    const deep = await renderLocation(realLocation("the-deep-dark"));
    const places = section(deep, "location-places");
    expect(places).toMatch(/Dungeon<\/span><span class="quest-count mono" data-testid="place-count">×23</);
    expect(places).toContain("Same name as the region");
    expect(deep).not.toContain('data-testid="location-map-link"');
  });

  it("groups its mobs by kind and links each mob page", async () => {
    const mobs = section(await renderLocation(realLocation("the-deep-dark")), "location-mobs");
    expect(mobs).toContain('href="/en/mobs/maw/"');
    expect(mobs.indexOf('data-group="boss"')).toBeLessThan(mobs.indexOf('data-group="regular"'));
  });

  it("links its quests and its area loot", async () => {
    const html = await renderLocation(realLocation("howling-woods"));
    expect(section(html, "location-quests")).toContain('href="/en/quests/ca03/"');
    expect(section(html, "location-loot")).toMatch(/href="\/en\/(melee|ranged|armor|artifact)\//);
  });

  it("leaves out empty sections", async () => {
    const html = await renderLocation(realLocation("lush-caves"));
    for (const id of ["location-places", "location-quests", "location-rewards", "location-facts"]) expect(html, id).not.toContain(`data-testid="${id}"`);
    expect(html).toContain('data-testid="location-mobs"');
    const bare = await renderLocation({ ...realLocation("lush-caves"), mobs: [] });
    expect(bare).not.toContain('data-testid="location-loot"');   // nothing known: the section stays hidden
  });

  it("groups the loot under category subheadings and marks unconfirmed books", async () => {
    const lush = section(await renderLocation(realLocation("lush-caves")), "location-loot");
    expect(lush).toContain('data-group="talisman"');
    expect(lush).toContain('location-subhead">Talismans <span class="count">(1)</span>');
    const ravines = section(await renderLocation(realLocation("ravines")), "location-loot");
    expect(count(ravines, 'data-testid="location-loot-unconfirmed"')).toBe(17);
    expect(ravines.indexOf('data-group="melee"')).toBeLessThan(ravines.indexOf('data-group="enchantment-book"'));
  });

  it("lists quest rewards in their own section", async () => {
    const html = await renderLocation(realLocation("squid-coast"));
    expect(count(section(html, "location-rewards"), 'data-testid="location-reward-item"')).toBe(4);
    expect(html).not.toContain('data-testid="location-loot"');
  });

  it("never skips a heading level", async () => {
    for (const slug of ["the-deep-dark", "howling-woods"]) {
      const levels = headings(await renderLocation(realLocation(slug)));
      expect(levels[0], slug).toBe(1);
      for (let i = 1; i < levels.length; i += 1) expect((levels[i] ?? 0) - (levels[i - 1] ?? 0), slug).toBeLessThanOrEqual(1);
    }
  });
});

describe("bosses page", () => {
  it("lists the bosses then the mini-bosses with the order rule", async () => {
    const html = await renderBosses();
    expect(count(html, 'data-testid="boss-card"')).toBe(16);
    expect(html.indexOf('data-testid="boss-group-boss"')).toBeLessThan(html.indexOf('data-testid="boss-group-miniboss"'));
    expect(html).toContain('data-testid="bosses-order"');
    expect(html.indexOf('data-slug="maw"')).toBeLessThan(html.indexOf('data-slug="monstrosity-copper"'));
  });

  it("links each boss's mob page, region, core quest and replay, with health", async () => {
    const html = await renderBosses("zh");
    const copper = html.slice(html.indexOf('data-slug="monstrosity-copper"'), html.indexOf('data-slug="frostbite-desert-boss"'));
    expect(copper).toContain('href="/zh/mobs/monstrosity-copper/"');
    expect(copper).toContain('href="/zh/locations/rainy-plains/"');
    expect(copper).toContain('href="/zh/quests/ca07/"');
    expect(copper).toContain('href="/zh/quests/ca07-br/"');
    expect(copper).toMatch(/data-testid="boss-health">2400</);
  });

  it("shows no region row for a boss the data places in no area, but still its quests", async () => {
    const html = await renderBosses();
    const start = html.indexOf('data-slug="soul-corrupted-witch"');
    const card = html.slice(start, html.indexOf('data-testid="boss-card"', start));   // the first card, up to the next
    expect(card).not.toContain('data-testid="boss-regions"');
    expect(card).toContain('href="/en/quests/ca02-b/"');
    expect(card).toContain('href="/en/quests/ca02-b-br/"');
  });

  it("marks a region name or a quest title that shows English", async () => {
    const [first] = bossList();
    const maw = first?.bosses.find((boss) => boss.mob.slug === "maw");
    if (!first || !maw) throw new Error("no bosses");
    const marked = {
      ...maw,
      locations: maw.locations.map((one) => ({ ...one, untranslated: ["ja" as const] })),
      coreQuests: maw.coreQuests.map((quest) => ({ ...quest, title: { ...quest.title, untranslated: ["ja" as const] } })),
    };
    const html = await renderBosses("ja", [{ kind: "boss", bosses: [marked] }]);
    const regions = html.slice(html.indexOf('data-testid="boss-regions"'), html.indexOf('data-testid="boss-core-quests"'));
    expect(count(regions, "tag warn")).toBe(1);
    expect(count(html, "tag warn")).toBe(2);
  });

  it("never skips a heading level", async () => {
    const levels = headings(await renderBosses());
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i += 1) expect((levels[i] ?? 0) - (levels[i - 1] ?? 0)).toBeLessThanOrEqual(1);
  });
});

describe("links back to locations", () => {
  it("opens the location page from a mob's area and keeps a map link", async () => {
    const mob = findMob("zombie");
    if (!mob) throw new Error("no zombie");
    const html = await container.renderToString(MobAreas, { props: { lang: "zh", areas: mob.areas } });
    expect(html).toMatch(/<a href="\/zh\/locations\/frozen-highlands\/">冰封高地<\/a>/);
    expect(html).toMatch(/class="mob-area-map" href="\/zh\/map\/\?world=overworld#4\/6611\/4173"/);
    expect(html).toContain('aria-label="地圖: 冰封高地"');
  });

  it("opens the location page from a quest's region", async () => {
    const quest = findQuest("ca05");
    if (!quest) throw new Error("no ca05");
    const html = await container.renderToString(QuestPage, { props: { lang: "en", quest }, params: { lang: "en", slug: quest.slug } });
    expect(html).toMatch(/href="\/en\/locations\/frozen-highlands\/" data-testid="quest-region-link">Frozen Fortress</);
  });

  it("falls back to the map for an area no location owns", async () => {
    const html = await container.renderToString(MobAreas, {
      props: { lang: "en", areas: [{ areaId: "SW.Area.Nowhere", name: { ...(findMob("zombie")?.areas[0]?.name ?? {}), en: "Nowhere" } }] },
    });
    expect(html).toContain('<a href="/en/map/">Nowhere</a>');
    expect(html).not.toContain("mob-area-map");
  });
});
