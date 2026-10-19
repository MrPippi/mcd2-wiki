import { describe, expect, it } from "vitest";
import {
  anyUntranslated, dropShares, fill, formatMultiplier, formatNumber, formatRange, formatShare, formatSigned, gearName, guideBySlug, guidesData, GUIDES,
  plainText, rarityName, roman, shown, textOf, tierNotes, unlockText,
} from "../../../src/lib/guides";
import { SITE_MENU } from "../../../src/lib/sections";

describe("guides site data", () => {
  it("lists six guides and finds each by slug", () => {
    expect(GUIDES.map((guide) => guide.slug)).toEqual(["vendors", "enchanting", "rarity", "threat", "secret-talismans", "progression"]);
    expect(guideBySlug("rarity")?.title).toBe("guideRarity");
    expect(guideBySlug("nope")).toBeUndefined();
  });

  it("puts the guides hub in the menu after the drop calculator", () => {
    const segments = SITE_MENU.map((item) => item.segment);
    expect(segments[segments.indexOf("drops") + 1]).toBe("guides");
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
    expect(formatNumber(0.0625, "en")).toBe("0.0625");
    expect(formatNumber(0.12345, "en")).toBe("0.1235");
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

describe("threat and difficulty data", () => {
  it("holds threat 1..20 with the game's numbers", () => {
    expect(guidesData.threat.map((row) => row.level)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    expect(guidesData.threat[0]).toMatchObject({ recommendedLevel: 0, effectTiers: [1, 0, 0], rarity: { common: 1, rare: 0.6, special: 0, unique: 0 } });
    expect(guidesData.threat[19]).toMatchObject({ recommendedLevel: 95, effectTiers: [0, 1, 1], rarity: { common: 0.5, rare: 0.5, special: 1, unique: 1 } });
    expect(guidesData.threat.slice(8, 20).map((row) => row.effectTiers?.[0])).toEqual([1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0]);
  });

  it("holds the three difficulties, Normal's multipliers assumed", () => {
    expect(guidesData.difficulty.map((item) => [item.id, item.incoming, item.outgoing, item.assumed ?? false, item.noRareDrops ?? false])).toEqual([
      ["low", 2, 1.5, false, true], ["normal", 1, 1, true, false], ["high", 0.8, 0.6, false, false],
    ]);
  });
});

describe("tierNotes", () => {
  it("reads where effect tiers start and end from the data", () => {
    expect(tierNotes(guidesData.threat)).toEqual([
      { tier: 1, kind: "ends", level: 20 },
      { tier: 2, kind: "starts", level: 3 },
      { tier: 3, kind: "starts", level: 6 },
    ]);
  });

  it("reports every switch of a factor that comes and goes", () => {
    const rows = [0, 1, 0, 1].map((factor, index) => ({ level: index + 1, effectTiers: [1, factor, 1] as [number, number, number] }));
    expect(tierNotes(rows)).toEqual([
      { tier: 2, kind: "starts", level: 2 }, { tier: 2, kind: "ends", level: 3 }, { tier: 2, kind: "starts", level: 4 },
    ]);
  });

  it("follows other curves: no notes for a tier present on every level, none without tier data", () => {
    const rows = [1, 2, 3, 4].map((level) => ({ level, effectTiers: [1, level >= 3 ? 1 : 0, 1] as [number, number, number] }));
    expect(tierNotes(rows)).toEqual([{ tier: 2, kind: "starts", level: 3 }]);
    expect(tierNotes([{ level: 1 }, { level: 2 }])).toEqual([]);
    expect(tierNotes([{ level: 1, effectTiers: [0, 0, 0] }])).toEqual([]);
  });
});

describe("threat formatting", () => {
  it("writes multipliers and ranges", () => {
    expect(formatMultiplier(0.91, "en")).toBe("×0.91");
    expect(formatRange({ min: 0.05, max: 0.1 }, (value) => formatShare(value, "en"))).toBe("5%–10%");
    expect(formatRange({ min: 1000, max: 4000 }, (value) => formatNumber(value, "de"))).toBe("1.000–4.000");
  });
});
