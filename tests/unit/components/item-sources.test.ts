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

  it("marks nothing on an English page", async () => {
    expect(await render("en", "artifact", "firework-quiver")).not.toContain("tag warn");
  });
});
