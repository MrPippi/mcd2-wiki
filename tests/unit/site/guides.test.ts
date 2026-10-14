import { describe, expect, it } from "vitest";
import {
  anyUntranslated, dropShares, fill, formatNumber, formatShare, formatSigned, gearName, guideBySlug, guidesData, GUIDES, plainText, rarityName,
  roman, shown, textOf, unlockText,
} from "../../../src/lib/guides";
import { SITE_MENU } from "../../../src/lib/site-menu";

describe("guides site data", () => {
  it("lists five guides and finds each by slug", () => {
    expect(GUIDES.map((guide) => guide.slug)).toEqual(["vendors", "enchanting", "rarity", "secret-talismans", "progression"]);
    expect(guideBySlug("rarity")?.title).toBe("guideRarity");
    expect(guideBySlug("nope")).toBeUndefined();
  });

  it("puts the guides hub in the menu after weapon compare", () => {
    const segments = SITE_MENU.map((item) => item.segment);
    expect(segments[segments.indexOf("compare") + 1]).toBe("guides");
  });

  it("holds the extracted game values", () => {
    expect(guidesData.vendors.map((vendor) => vendor.levels.map((level) => level.cost))).toEqual([[10, 15], [20, 40], [30, 60]]);
    expect(guidesData.caps).toEqual({ emeralds: 99999, echoShards: 100, level: 100 });
    expect(guidesData.secretTalismans.talismans).toHaveLength(8);
    expect(guidesData.stages.length).toBeGreaterThan(0);
  });

  it("calls the currency Echo Shards in the game's words, never SpringStone", () => {
    expect(textOf(guidesData, "echoShards", "en")?.html).toBe("Echo Shards");
    expect(textOf(guidesData, "echoShards", "zh")?.html).toBe("回聲碎片");
    expect(JSON.stringify(guidesData.texts)).not.toMatch(/SpringStone/i);
  });

  it("shows the Dutch enchantment points title in English, marked", () => {
    expect(textOf(guidesData, "enchantmentPoints", "nl")).toEqual({ html: "Enchantment points", untranslated: true });
  });

  it("has no shown text for an empty or missing one", () => {
    expect(shown(null, "en")).toBeUndefined();
    expect(shown({ html: { ...guidesData.texts.echoShards.html, en: "" }, untranslated: [] }, "en")).toBeUndefined();
    expect(anyUntranslated([undefined, { html: "x", untranslated: true }])).toBe(true);
    expect(anyUntranslated([{ html: "x", untranslated: false }])).toBe(false);
  });

  it("finds each vendor level's unlock text and nothing for other levels", () => {
    expect(unlockText(guidesData, "enchantsmith", 3, "en")?.html).toContain("level III");
    expect(unlockText(guidesData, "merchant", 4, "en")).toBeUndefined();
  });
});

describe("guides formatting", () => {
  it("writes numbers, signs and shares the page language's way", () => {
    expect(formatNumber(99999, "en")).toBe("99,999");
    expect(formatNumber(99999, "de")).toBe("99.999");
    expect(formatSigned(-2, "en")).toBe("-2");
    expect(formatSigned(1, "en")).toBe("+1");
    expect(formatSigned(0, "en")).toBe("0");
    expect(formatShare(0.5, "en")).toBe("50%");
    expect(formatShare(1 / 3, "de")).toMatch(/^33,3\s?%$/);
  });

  it("fills a template with escaped text and trusted HTML", () => {
    expect(fill("Pay {n} <{currency}> {missing}", { n: "<3", currency: { html: "<em>Echo</em>" } })).toBe("Pay &lt;3 &lt;<em>Echo</em>&gt; {missing}");
  });

  it("strips HTML for attributes", () => {
    expect(plainText("L&#39;<em>Enchanteur</em> &amp; co")).toBe("L'Enchanteur & co");
  });

  it("writes levels as the game does and names rarities and gear in the page language", () => {
    expect(roman(3)).toBe("III");
    expect(roman(9)).toBe("9");
    expect(rarityName("special", "zh")).toBe("特殊");
    expect(gearName("helmet", "en")).toBe("Helmet");
    expect(gearName("melee", "zh")).toBe("近戰武器");
  });
});

describe("dropShares", () => {
  it("divides each weight by its row's total", () => {
    const [defaults] = guidesData.rarity.drops;
    expect(dropShares(defaults, "en").map((row) => [row.weight, row.share])).toEqual([["50", 0.5], ["25", 0.25], ["20", 0.2], ["5", 0.05]]);
  });

  it("counts a ×0 multiplier as zero", () => {
    const boss = guidesData.rarity.drops[1];
    const shares = dropShares(boss, "en");
    expect(shares[0]).toEqual({ rarity: "common", weight: "×0", share: 0 });
    expect(shares[1].share).toBeCloseTo(0.5);
  });

  it("gives no shares when a multiplier is not ×0 or the total is zero", () => {
    expect(dropShares({ source: "boss", weights: [{ rarity: "common", weight: 0.5, operation: "multiply" }, { rarity: "rare", weight: 1, operation: "set" }] }, "en").map((row) => row.share)).toEqual([null, null]);
    expect(dropShares({ source: "boss", weights: [{ rarity: "rare", weight: 0, operation: "set" }] }, "en")[0].share).toBeNull();
  });
});
