import { describe, expect, it } from "vitest";
import { pagesFromResponse } from "../../../scripts/wiki/fetch";

const page = (title: string, revid: number, content: string) => ({
  title,
  revisions: [{ revid, slots: { main: { content } } }],
});

describe("pagesFromResponse", () => {
  it("keys pages by the title that was asked for, following normalisation and redirects", () => {
    const pages = pagesFromResponse({
      query: {
        normalized: [{ from: "Dungeons_II:Axe", to: "Dungeons II:Axe" }],
        redirects: [{ from: "Dungeons II:Burning Blade", to: "Dungeons II:The Burning Blade" }],
        pages: [page("Dungeons II:Axe", 1, "axe"), page("Dungeons II:The Burning Blade", 2, "blade")],
      },
    });
    expect(pages.get("Dungeons_II:Axe")).toEqual({ title: "Dungeons II:Axe", revision: 1, text: "axe" });
    expect(pages.get("Dungeons II:Axe")?.text).toBe("axe");
    expect(pages.get("Dungeons II:Burning Blade")).toEqual({ title: "Dungeons II:The Burning Blade", revision: 2, text: "blade" });
  });

  it("leaves out missing pages", () => {
    expect(pagesFromResponse({ query: { pages: [{ title: "Dungeons II:Nope", missing: true }] } }).size).toBe(0);
  });

  it("rejects an API error or an unexpected shape", () => {
    expect(() => pagesFromResponse({ error: { code: "ratelimited", info: "Slow down" } })).toThrow(/ratelimited/);
    expect(() => pagesFromResponse({ nope: 1 })).toThrow();
  });
});
