import { describe, expect, it } from "vitest";
import { TEXT_IDS } from "../../../scripts/extract/guides-schema";
import { buildGuideTexts, englishOnly, gameText, GUIDE_ENGLISH_ONLY, GUIDE_TEXT_KEYS, rowText } from "../../../scripts/extract/guides-texts";
import { makeSparseLocales } from "../../helpers/locales";

const ON = "Text/Release/OnboardingLabels.csv";
const VENDOR = "Text/Release/VendorLabels.csv";
const locales = makeSparseLocales({
  [ON]: {
    tutoriallog_springstones_title: { en: "Echo Shards", zh: "回聲碎片", ja: "残響のかけら" },
    tutoriallog_enchantmentpoints_title: { en: "Enchantment points", zh: "附魔點數", nl: "Betoveringsboeken" },
    panel_villagemerchant_overview_description1: { en: "Use <emphasis>emeralds</> to purchase items", zh: "使用<emphasis>綠寶石</>購買物品" },
  },
  [VENDOR]: { vendor_village_merchant_title: { en: "Town Merchant" } },
});

describe("gameText", () => {
  it("renders markup in every language and lists the languages that fall back to English", () => {
    const { text, issues } = gameText(locales, ON, "panel_villagemerchant_overview_description1");
    expect(text?.html.zh).toBe('使用<em class="emphasis">綠寶石</em>購買物品');
    expect(text?.html.de).toBe('Use <em class="emphasis">emeralds</em> to purchase items');
    expect(text?.untranslated).toContain("de");
    expect(text?.untranslated).not.toContain("zh");
    expect(issues).toEqual([]);
  });

  it("has no text and an issue without English", () => {
    expect(gameText(locales, ON, "nope")).toEqual({ issues: [{ type: "guides-text-fallback", detail: "OnboardingLabels.csv/nope" }] });
  });
});

describe("rowText", () => {
  const texts = { Texts: { '(TagName="SW.TextEntry.Name")': { Text: 'LOCTABLE("VendorLabels.csv", "vendor_village_merchant_title")' } } };
  it("follows the row's LOCTABLE reference for one text entry", () => {
    expect(rowText(locales, texts, "SW.TextEntry.Name").text?.html.en).toBe("Town Merchant");
  });
  it("reports an entry the row does not have", () => {
    expect(rowText(locales, texts, "SW.TextEntry.Description").issues[0]?.type).toBe("guides-text-fallback");
    expect(rowText(locales, undefined, "SW.TextEntry.Name").text).toBeUndefined();
  });
});

describe("englishOnly", () => {
  it("switches the listed languages to English and marks them once", () => {
    const { text } = gameText(locales, ON, "tutoriallog_enchantmentpoints_title");
    if (!text) throw new Error("fixture");
    const fixed = englishOnly(text, ["nl", "de"]);
    expect(fixed.html.nl).toBe("Enchantment points");
    expect(fixed.html.zh).toBe("附魔點數");
    expect(fixed.untranslated.filter((lang) => lang === "de")).toHaveLength(1);
    expect(fixed.untranslated).toContain("nl");
    expect(englishOnly(text, [])).toBe(text);
  });
});

describe("buildGuideTexts", () => {
  it("has a key for every text id", () => {
    expect(Object.keys(GUIDE_TEXT_KEYS).sort()).toEqual([...TEXT_IDS].sort());
  });

  it("shows the Dutch enchantment points title in English (it says enchantment books)", () => {
    expect(GUIDE_ENGLISH_ONLY.enchantmentPoints?.langs).toEqual(["nl"]);
    const { texts } = buildGuideTexts(locales);
    expect(texts.enchantmentPoints.html.nl).toBe("Enchantment points");
    expect(texts.enchantmentPoints.untranslated).toContain("nl");
    expect(texts.echoShards.html.ja).toBe("残響のかけら");
  });

  it("leaves a text without English empty and reports it", () => {
    const { texts, issues } = buildGuideTexts(locales);
    expect(texts.levelingTutorial.html.en).toBe("");
    expect(issues.map((item) => item.detail)).toContain("OnboardingLabels.csv/tutoriallog_levelingup_description");
  });
});
