import { describe, expect, it } from "vitest";
import type { Localized } from "../../../shared/schemas";
import { humanizeId, SOURCE_NAME_KEYS, sourceName, talismanChestName } from "../../../scripts/extract/source-names";
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

  it("names a quest without a game name by the site's translated label only, never by its internal row id", () => {
    const quest = sourceName("QuestArtifactsCA10_BR_B", {}, locales, /^Quest/, "quest");
    expect(quest.name.en).toBe("Quest reward");
    expect(quest.name.zh).toBe("任務獎勵");
    expect(quest.untranslated).toEqual([]);
    expect(quest.official).toBe(false);
  });

  it("gives chests, merchants and book pools their English words with no kind prefix (the group heading says the kind)", () => {
    const chest = sourceName("OtherChest", {}, locales, undefined, "chest");
    expect(chest.name.zh).toBe("Other Chest");
    expect(chest.untranslated).toHaveLength(15);
    expect(sourceName("VillageMerchant", {}, locales, undefined, "merchant").name.en).toBe("Village Merchant");
    expect(sourceName("EnchantmentBooksDeepDark", {}, locales, /^EnchantmentBooks/, "bookPool").name.zh).toBe("Deep Dark");
  });

  it("names the global book pool by the site's translated label", () => {
    const common = sourceName("EnchantmentBooksCommon", {}, locales, /^EnchantmentBooks/, "bookPool");
    expect(common.name.en).toBe("All areas");
    expect(common.name.ja).toBe("すべての地域");
    expect(common.untranslated).toEqual([]);
    expect(common.official).toBe(false);
  });

  it("names the chests the game gives no text by the site's translated labels", () => {
    const fancy = sourceName("FancyChest", {}, locales, undefined, "chest");
    expect(fancy.name.en).toBe("Fancy Chest");
    expect(fancy.name.zh).toBe("華麗寶箱");
    expect(fancy.untranslated).toEqual([]);
    expect(fancy.official).toBe(false);
    expect(sourceName("WellspringChest", {}, locales, undefined, "chest").name.zh).toBe("隙浮寶箱");
    expect(sourceName("CampWoodenChest", {}, locales, undefined, "chest").name.zh).toBe("營地木箱");
  });

  it("names a chest by the one item it holds after the site's label", () => {
    const name = talismanChestName({ en: "Speed", zh: "速度" } as Localized, ["ja"]);
    expect(name.name.en).toBe("Talisman Chest · Speed");
    expect(name.name.zh).toBe("護符寶箱 · 速度");
    expect(name.untranslated).toEqual(["ja"]);
    expect(name.official).toBe(false);
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
