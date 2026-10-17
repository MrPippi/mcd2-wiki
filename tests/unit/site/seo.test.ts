import { describe, expect, it } from "vitest";
import {
  absoluteUrl, articleLd, breadcrumbLd, pageSummary, serializeJsonLd, websiteLd,
} from "../../../src/lib/seo";

const SITE = new URL("https://mrpippi.github.io");

describe("absoluteUrl", () => {
  it("resolves a path against the site", () => {
    expect(absoluteUrl("/mcd2-wiki/zh/", SITE)).toBe("https://mrpippi.github.io/mcd2-wiki/zh/");
  });

  it("keeps the path when the site address is unknown", () => {
    expect(absoluteUrl("/zh/", undefined)).toBe("/zh/");
  });
});

describe("pageSummary", () => {
  const tagline = "收錄武器與護甲。";

  it("keeps the page's own description", () => {
    expect(pageSummary({ description: "近戰武器。", title: "劍", tagline })).toBe("近戰武器。");
  });

  it("uses the tagline alone on the home page", () => {
    expect(pageSummary({ description: "", title: "首頁", tagline, home: true })).toBe(tagline);
  });

  it("leads with the title elsewhere so pages without text still differ", () => {
    expect(pageSummary({ description: "  ", title: "近戰武器", tagline })).toBe("近戰武器 — 收錄武器與護甲。");
  });

  it("stays within the snippet length", () => {
    expect([...pageSummary({ description: "字".repeat(300), title: "x", tagline })]).toHaveLength(160);
  });
});

describe("serializeJsonLd", () => {
  it("escapes characters that could close the script element", () => {
    const out = serializeJsonLd({ name: "</script><b>&" });
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(JSON.parse(out)).toEqual({ name: "</script><b>&" });
  });
});

describe("breadcrumbLd", () => {
  it("numbers the trail from one", () => {
    const ld = breadcrumbLd([
      { name: "首頁", url: "https://x.test/zh/" },
      { name: "近戰武器", url: "https://x.test/zh/melee/" },
    ]);
    expect(ld).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "首頁", item: "https://x.test/zh/" },
        { "@type": "ListItem", position: 2, name: "近戰武器", item: "https://x.test/zh/melee/" },
      ],
    });
  });
});

describe("websiteLd", () => {
  it("describes the site with a search action on the search page", () => {
    const ld = websiteLd({
      name: "Wiki", url: "https://x.test/zh/", lang: "zh-TW", description: "d", searchUrl: "https://x.test/zh/search/",
    });
    expect(ld["@type"]).toBe("WebSite");
    expect(ld.inLanguage).toBe("zh-TW");
    expect(ld.about).toEqual({ "@type": "VideoGame", name: "Minecraft Dungeons II" });
    expect(ld.potentialAction).toEqual({
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: "https://x.test/zh/search/?q={search_term_string}" },
      "query-input": "required name=search_term_string",
    });
  });
});

describe("articleLd", () => {
  it("marks a guide as an article about the game", () => {
    const ld = articleLd({ headline: "附魔", description: "d", url: "https://x.test/zh/guides/enchanting/", lang: "zh-TW", siteName: "Wiki", siteUrl: "https://x.test/zh/" });
    expect(ld).toMatchObject({
      "@type": "Article",
      headline: "附魔",
      mainEntityOfPage: "https://x.test/zh/guides/enchanting/",
      inLanguage: "zh-TW",
      about: { "@type": "VideoGame", name: "Minecraft Dungeons II" },
      publisher: { "@type": "Organization", name: "Wiki", url: "https://x.test/zh/" },
    });
  });
});
