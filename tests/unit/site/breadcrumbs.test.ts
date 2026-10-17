import { describe, expect, it } from "vitest";
import { breadcrumbTrail } from "../../../src/lib/breadcrumbs";
import { categoryLabel, t } from "../../../src/lib/i18n";

describe("breadcrumbTrail", () => {
  it("has no trail on a language home", () => {
    expect(breadcrumbTrail("/mcd2-wiki/zh/", "/mcd2-wiki/", "zh", "首頁")).toEqual([]);
  });

  it("goes home, then the page, for a top-level page", () => {
    expect(breadcrumbTrail("/zh/bosses/", "/", "zh", "頭目")).toEqual([
      { name: t("zh", "home"), href: "/zh/" },
      { name: "頭目", href: "/zh/bosses/" },
    ]);
  });

  it("puts the category between home and an entry", () => {
    expect(breadcrumbTrail("/mcd2-wiki/en/melee/sword/", "/mcd2-wiki/", "en", "Sword")).toEqual([
      { name: t("en", "home"), href: "/mcd2-wiki/en/" },
      { name: categoryLabel("melee", "en"), href: "/mcd2-wiki/en/melee/" },
      { name: "Sword", href: "/mcd2-wiki/en/melee/sword/" },
    ]);
  });

  it("files armor pieces under armor", () => {
    const trail = breadcrumbTrail("/en/armor/piece/hood/", "/", "en", "Hood");
    expect(trail.map((crumb) => crumb.href)).toEqual(["/en/", "/en/armor/", "/en/armor/piece/hood/"]);
  });

  it("names non-category sections from the UI strings", () => {
    const trail = breadcrumbTrail("/ja/guides/rarity/", "/", "ja", "x");
    expect(trail[1]).toEqual({ name: t("ja", "guides"), href: "/ja/guides/" });
  });

  it("skips a section it cannot name", () => {
    expect(breadcrumbTrail("/en/unknown/x/", "/", "en", "X").map((crumb) => crumb.href)).toEqual(["/en/", "/en/unknown/x/"]);
  });
});
