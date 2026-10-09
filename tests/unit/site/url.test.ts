import { describe, expect, it } from "vitest";
import { makeEntry } from "../../helpers/entries";
import { entryHref, href, swapLangPath, withBase } from "../../../src/lib/url";

describe("url helpers", () => {
  it("joins a base and a path", () => {
    expect(withBase("/", "icons/a.png")).toBe("/icons/a.png");
    expect(withBase("/mcd2-wiki", "/icons/a.png")).toBe("/mcd2-wiki/icons/a.png");
  });

  it("builds language-prefixed links with a trailing slash", () => {
    expect(href("zh")).toBe("/zh/");
    expect(href("en", "melee", "sword")).toBe("/en/melee/sword/");
  });

  it("swaps the language segment", () => {
    expect(swapLangPath("/zh/melee/sword/", "/", "en")).toBe("/en/melee/sword/");
    expect(swapLangPath("/zh/", "/", "en")).toBe("/en/");
    expect(swapLangPath("/mcd2-wiki/en/armor/disciple/", "/mcd2-wiki/", "zh")).toBe("/mcd2-wiki/zh/armor/disciple/");
  });

  it("routes entries by category", () => {
    expect(entryHref("zh", makeEntry("Sword", "melee"))).toBe("/zh/melee/sword/");
    expect(entryHref("zh", makeEntry("DiscipleBoots", "armor"))).toBe("/zh/armor/piece/disciple-boots/");
    expect(entryHref("en", makeEntry("CriticalEdge", "effect"))).toBe("/en/effect/#critical-edge");
  });

  it("sends enchantment books to their enchantment page", () => {
    const book = makeEntry("EnchantmentBook_SoulAspect", "enchantment-book", { links: { enchantment: "soul-fire-aspect" } });
    expect(entryHref("zh", book)).toBe("/zh/enchantment/soul-fire-aspect/");
  });
});
