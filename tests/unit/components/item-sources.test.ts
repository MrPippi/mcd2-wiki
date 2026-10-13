import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import type { Category } from "../../../scripts/extract/config";
import ItemSources from "../../../src/components/ItemSources.astro";
import { findEntry } from "../../../src/lib/data";

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});

const render = async (lang: string, category: Category, slug: string): Promise<string> => {
  const entry = findEntry(category, slug);
  if (!entry) throw new Error(`no ${category}/${slug}`);
  return container.renderToString(ItemSources, { props: { lang, entry } });
};

/** The HTML of one source group (areas, chests, …). */
const group = (html: string, kind: string): string => {
  const match = html.match(new RegExp(`data-source-kind="${kind}"[^]*?</ul>`));
  if (!match) throw new Error(`no ${kind} group`);
  return match[0];
};

describe("item sources block", () => {
  it("marks a group whose every name fell back to English once, on its heading, without the English repeated", async () => {
    const chests = group(await render("zh", "artifact", "firework-quiver"), "chests");
    expect(chests).toMatch(/<h3[^>]*>[^]*?class="tag warn"[^]*?<\/h3>/);
    expect(chests.split("tag warn").length - 1).toBe(1);
    expect(chests).not.toContain("item-alt");
  });

  it("keeps translated groups unmarked, with the comparison name", async () => {
    const areas = group(await render("zh", "artifact", "firework-quiver"), "areas");
    expect(areas).not.toContain("tag warn");
    expect(areas).toContain("item-alt");
  });

  it("shows a quest reward by its quest, linked, and 必得 or N of M, never the internal row id", async () => {
    const quests = group(await render("zh", "armor", "mushroom-chest"), "quests");
    expect(quests).toMatch(/<a href="\/zh\/quests\/foa1-s10-a\/">[^<]+<\/a>的獎勵/);
    expect(quests).toContain('data-testid="picks"');
    expect(quests).not.toMatch(/Armour|Quest[A-Z]/);
    expect(quests).not.toContain("tag warn");
  });

  it("names a chest without repeating the kind the heading already gives", async () => {
    const chests = group(await render("zh", "artifact", "firework-quiver"), "chests");
    expect(chests).toContain("Camp Wooden Chest");
    expect(chests).not.toContain("寶箱：");
  });

  it("shows no Chinese fallback line on an English page", async () => {
    expect(group(await render("en", "artifact", "firework-quiver"), "chests")).not.toContain("item-alt");
  });

  it("marks nothing on an English page", async () => {
    expect(await render("en", "artifact", "firework-quiver")).not.toContain("tag warn");
  });
});
