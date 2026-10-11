import { describe, expect, it } from "vitest";
import { humanizeId, SOURCE_NAME_KEYS, sourceName } from "../../../scripts/extract/source-names";
import { makeLocales, ns } from "../../helpers/locales";

const locales = makeLocales({
  [ns("VendorLabels")]: { merchant_name: { en: "Village Merchant", zh: "村莊商人" }, half: { en: "Half", zh: "一半", ja: "" } },
});

describe("humanizeId", () => {
  it("turns a row name into English words", () => {
    expect(humanizeId("QuestArmourMushroomSet", /^Quest/)).toBe("Armour Mushroom Set");
    expect(humanizeId("FancyChest_Procedural")).toBe("Fancy Chest Procedural");
    expect(humanizeId("EnchantmentBooksDeepDark", /^EnchantmentBooks/)).toBe("Deep Dark");
  });

  it("keeps acronyms and numbers together and drops stray punctuation", () => {
    expect(humanizeId("QuestArtifactsCA10_BR_B", /^Quest/)).toBe("Artifacts CA10 BR B");
    expect(humanizeId("QuestMeleeDaggerUnique_)1", /^Quest/)).toBe("Melee Dagger Unique 1");
    expect(humanizeId("SW.Area.Plains.A1", /^SW\.Area\./)).toBe("Plains A1");
  });
});

describe("sourceName", () => {
  it("uses the game's text when a locale key is known", () => {
    const name = sourceName("VillageMerchant", { VillageMerchant: { namespace: ns("VendorLabels"), key: "merchant_name" } }, locales);
    expect(name.name.zh).toBe("村莊商人");
    expect(name.untranslated).toEqual([]);
    expect(name.official).toBe(true);
  });

  it("marks the languages that show the game's English text as untranslated", () => {
    const name = sourceName("Half", { Half: { namespace: ns("VendorLabels"), key: "half" } }, locales);
    expect(name.name.ja).toBe("Half");
    expect(name.untranslated).toEqual(["ja"]);
  });

  it("falls back to English words and marks every other language untranslated", () => {
    const name = sourceName("QuestArmourMushroomSet", {}, locales, /^Quest/);
    expect(name.name.en).toBe("Armour Mushroom Set");
    expect(name.name.ja).toBe("Armour Mushroom Set");
    expect(name.untranslated).toHaveLength(15);
    expect(name.untranslated).not.toContain("en");
    expect(name.official).toBe(false);
  });

  it("puts the fallback words into the site's label for the kind of source", () => {
    const quest = sourceName("QuestArmourMushroomSet", {}, locales, /^Quest/, "quest");
    expect(quest.name.en).toBe("Quest reward: Armour Mushroom Set");
    expect(quest.name.zh).toBe("任務獎勵：Armour Mushroom Set");
    expect(quest.untranslated).toHaveLength(15);
    expect(sourceName("FancyChest", {}, locales, undefined, "chest").name.zh).toBe("寶箱：Fancy Chest");
    expect(sourceName("VillageMerchant", {}, locales, undefined, "merchant").name.en).toBe("Merchant: Village Merchant");
    expect(sourceName("EnchantmentBooksCommon", {}, locales, /^EnchantmentBooks/, "bookPool").name.zh).toBe("附魔書池：Common");
  });

  it("uses the game's text over the kind label when a key is known", () => {
    const name = sourceName("VillageMerchant", { VillageMerchant: { namespace: ns("VendorLabels"), key: "merchant_name" } }, locales, undefined, "merchant");
    expect(name.name.en).toBe("Village Merchant");
  });
});

describe("SOURCE_NAME_KEYS", () => {
  it("points the village merchant at the game's merchant title", () => {
    expect(SOURCE_NAME_KEYS.VillageMerchant).toEqual({ namespace: "Text/Release/VendorLabels.csv", key: "vendor_village_merchant_title" });
  });
});
