import { describe, expect, it } from "vitest";
import { llmsTxt } from "../../../src/lib/llms";

const SITE = new URL("https://mrpippi.github.io");
const BASE = "/mcd2-wiki/";

describe("llmsTxt", () => {
  const text = llmsTxt(SITE, BASE);

  it("starts with the llms.txt title and summary", () => {
    const lines = text.split("\n");
    expect(lines[0]).toBe("# Minecraft Dungeons II Wiki");
    expect(lines[2].startsWith("> ")).toBe(true);
  });

  it("links the English and Chinese sections with absolute URLs", () => {
    expect(text).toContain("](https://mrpippi.github.io/mcd2-wiki/en/melee/)");
    expect(text).toContain("](https://mrpippi.github.io/mcd2-wiki/zh/guides/enchanting/)");
  });

  it("lists every language home", () => {
    expect(text).toContain("https://mrpippi.github.io/mcd2-wiki/uk/");
    expect(text).toContain("https://mrpippi.github.io/mcd2-wiki/zh-hans/");
  });

  it("points to the sitemap", () => {
    expect(text).toContain("https://mrpippi.github.io/mcd2-wiki/sitemap-index.xml");
  });

  it("uses root-relative links without a site address", () => {
    expect(llmsTxt(undefined, "/")).toContain("](/en/melee/)");
  });
});
