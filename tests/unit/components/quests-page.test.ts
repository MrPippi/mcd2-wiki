import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import type { Quest, QuestData } from "../../../scripts/extract/quest-schema";
import AchievementReveal from "../../../src/components/AchievementReveal.astro";
import ItemSources from "../../../src/components/ItemSources.astro";
import { localizedFrom } from "../../../src/lib/lang";
import { findEntry } from "../../../src/lib/data";
import { findQuest, questData } from "../../../src/lib/quests";
import QuestPage from "../../../src/pages/[lang]/quests/[slug].astro";
import QuestsIndex from "../../../src/pages/[lang]/quests/index.astro";

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});

const count = (html: string, needle: string): number => html.split(needle).length - 1;
const realQuest = (slug: string): Quest => {
  const quest = findQuest(slug);
  if (!quest) throw new Error(`no quest ${slug} in quests.json`);
  return quest;
};
const renderList = (lang: string, data: QuestData = questData) => container.renderToString(QuestsIndex, { props: { lang, data }, params: { lang } });
const renderQuest = (quest: Quest, lang = "en") => container.renderToString(QuestPage, { props: { lang, quest }, params: { lang, slug: quest.slug } });
/** The HTML from a test id to the end of its element's section. */
const section = (html: string, testid: string): string => {
  const start = html.indexOf(`data-testid="${testid}"`);
  if (start === -1) throw new Error(`no ${testid}`);
  const end = html.indexOf("</section>", start);
  return html.slice(start, end === -1 ? undefined : end);
};

describe("quest list", () => {
  it("shows the four sections in order with their counts", async () => {
    const html = await renderList("en");
    const order = ["core", "side", "echoGolem", "bossReplay"].map((id) => html.indexOf(`data-testid="quest-section-${id}"`));
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(count(html, 'data-testid="quest-card"')).toBe(42);
    expect(section(html, "quest-section-core")).toContain("Core Quests</span> <span class=\"count\">(15)</span>");
    expect(section(html, "quest-section-bossReplay")).toContain("(7)");
  });

  it("groups side quests under their regions and numbers the core chain", async () => {
    const html = await renderList("zh");
    const side = section(html, "quest-section-side");
    expect(count(side, 'data-testid="quest-region"')).toBe(7);
    expect(side).toContain("蜂巢原野");
    expect(section(html, "quest-section-core")).toContain('class="quest-step mono"');
    expect(side).not.toContain("quest-step");
  });

  it("links each card to its quest page and shows the comparison title", async () => {
    const html = await renderList("zh");
    expect(html).toContain('href="/zh/quests/ca02/"');
    expect(html).toContain("The Silence in Little Howl");
  });

  it("leaves out empty sections", async () => {
    const onlyCore = { ...questData, quests: questData.quests.filter((quest) => quest.section === "core") };
    const html = await renderList("en", onlyCore);
    expect(html).not.toContain("quest-section-side");
    expect(count(html, 'data-testid="quest-card"')).toBe(15);
  });
});

describe("quest page", () => {
  it("shows prerequisites and unlocked quests as links", async () => {
    const html = await renderQuest(realQuest("ca02"));
    expect(section(html, "quest-prerequisites")).toContain('href="/en/quests/ca01-b/"');
    expect(section(html, "quest-unlocks")).toContain('href="/en/quests/ca02-c/"');
  });

  it("lists objectives with counts", async () => {
    const html = await renderQuest(realQuest("pla1-s04-a"));
    const objectives = section(html, "quest-objectives");
    expect(objectives).toContain("Collect planks for the beehives");
    expect(objectives).toContain("×3");
    expect(count(objectives, "Find a spot to build beehives")).toBe(1);
  });

  it("splits rewards into first and every completion, links items and shows emeralds by size", async () => {
    const html = await renderQuest(realQuest("ca04"));
    const first = section(html, "quest-rewards-first");
    expect(first).toContain('href="/en/armor/piece/');
    expect(first).toContain('data-testid="picks"');
    expect(first).toContain("Rare");
    const every = section(html, "quest-rewards-every");
    expect(every).toContain("Random item from Howling Woods");
    expect(every).toContain('href="/en/talisman/');
    expect(section(html, "quest-emeralds")).toContain("Guaranteed: <span class=\"mob-drop-num\">8</span>");
  });

  it("names a reward book without linking an enchantment page the site does not publish", async () => {
    const html = await renderQuest(realQuest("dea1-s12-a"));
    expect(html).not.toContain("/enchantment/soul-fire-aspect/");
    expect(section(html, "quest-rewards-every")).toMatch(/<span class="quest-reward-item"[^>]*data-testid="quest-reward-item"/);
  });

  it("shows the description, completed text, region link and related mobs", async () => {
    const html = await renderQuest(realQuest("ca03"), "zh");
    expect(html).toContain('data-testid="quest-description"');
    expect(html).toContain('data-testid="quest-completed"');
    expect(html).toMatch(/data-testid="quest-region-link"[^>]*>|href="\/zh\/map\/[^"]*"[^>]*data-testid="quest-region-link"/);
    expect(section(html, "quest-mobs")).toContain('href="/zh/mobs/maw/"');
  });

  it("marks an untranslated title once and leaves the completed text out when the game has none", async () => {
    const quest = realQuest("ca10-br-b");
    const html = await renderQuest({ ...quest, title: { ...quest.title, untranslated: ["ja"] } }, "ja");
    expect(html).toMatch(/class="quest-title"[^]*?class="tag warn"/);
    expect(count(html, "tag warn")).toBe(1);
    expect(html).not.toContain('data-testid="quest-completed"');
  });
});

describe("item page quest sources", () => {
  it("names and links the quest that gives a known reward", async () => {
    const entry = findEntry("armor", "mushroom-chest");
    if (!entry) throw new Error("no mushroom chest");
    const html = await container.renderToString(ItemSources, { props: { lang: "en", entry } });
    expect(html).toContain('data-testid="source-reward-of"');
    expect(html).toMatch(/Reward of <a href="\/en\/quests\/foa1-s10-a\/">The Cleric’s Apprentice<\/a>/);
  });

  it("keeps the generic label where the quest is not exactly known", async () => {
    // Also given by CA04_BR, a title-less quest the site leaves out, so the giver is not exactly known.
    const entry = findEntry("talisman", "ranged-buff");
    if (!entry) throw new Error("no ranged-buff talisman");
    const html = await container.renderToString(ItemSources, { props: { lang: "en", entry } });
    expect(html).toContain('data-source-kind="quests"');
    expect(html).toContain('<span class="source-name">Quest reward</span>');
    expect(html).not.toContain("source-reward-of");
  });
});

describe("achievement conditions", () => {
  const name = localizedFrom(() => "Escape from Squid Coast");
  it("links a quest condition to its quest page", async () => {
    const html = await container.renderToString(AchievementReveal, { props: { lang: "en", condition: { type: "quest", name, quest: "CA00" } } });
    expect(html).toMatch(/<a class="primary" href="\/en\/quests\/ca00\/"[^>]*>Complete/);
  });
  it("leaves a condition without a published quest as text", async () => {
    for (const condition of [{ type: "boss" as const, name }, { type: "quest" as const, name, quest: "CA04_BR" }]) {
      const html = await container.renderToString(AchievementReveal, { props: { lang: "en", condition } });
      expect(html).not.toContain("condition-quest-link");
    }
  });
});
