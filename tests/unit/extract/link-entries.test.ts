import { describe, expect, it } from "vitest";
import { commonPrefix, linkEntries, setNameFor } from "../../../scripts/extract/link-entries";
import { makeEntry } from "../../helpers/entries";
import { loc } from "../../helpers/localized";

const find = (entries: ReturnType<typeof linkEntries>["entries"], id: string) => entries.find((e) => e.id === id);

describe("linkEntries — variants", () => {
  it("links normal and unique variants both ways", () => {
    const { entries } = linkEntries([makeEntry("Sword", "melee"), makeEntry("Sword_Unique1", "melee")]);
    expect(find(entries, "Sword")?.links).toEqual({ variants: ["sword-unique1"] });
    expect(find(entries, "Sword_Unique1")?.links).toEqual({ variants: ["sword"] });
  });

  it("never links to upcoming entries", () => {
    const { entries } = linkEntries([
      makeEntry("Halberd", "melee"),
      makeEntry("Halberd_Unique1", "melee", { release: "upcoming" }),
    ]);
    expect(find(entries, "Halberd")?.links).toEqual({});
    expect(find(entries, "Halberd_Unique1")?.links).toEqual({});
  });
});

describe("linkEntries — enchantment books", () => {
  it("links books and enchantments by id", () => {
    const { entries } = linkEntries([makeEntry("Arcane", "enchantment"), makeEntry("EnchantmentBook_Arcane", "enchantment-book")]);
    expect(find(entries, "Arcane")?.links).toEqual({ enchantmentBook: "arcane" });
    expect(find(entries, "EnchantmentBook_Arcane")?.links).toEqual({ enchantment: "arcane" });
  });

  it("falls back to the English name when ids differ", () => {
    const name = loc({ zh: "靈魂火焰", en: "Soul Fire Aspect" });
    const { entries, issues } = linkEntries([
      makeEntry("SoulFireAspect", "enchantment", { name }),
      makeEntry("EnchantmentBook_SoulAspect", "enchantment-book", { name: { ...name, en: " soul fire aspect " } }),
    ]);
    expect(find(entries, "EnchantmentBook_SoulAspect")?.links).toEqual({ enchantment: "soul-fire-aspect" });
    expect(issues).toEqual([]);
  });

  it("reports books without an enchantment", () => {
    const { issues } = linkEntries([makeEntry("EnchantmentBook_Lonely", "enchantment-book")]);
    expect(issues).toEqual([{ type: "unlinked-enchantment", detail: "EnchantmentBook_Lonely" }]);
  });
});

/** Languages whose set names fall back to English until they get their own naming rule. */
const LATER_LANGS = ["zh-hans", "ja", "ko", "de", "fr", "es", "it", "pt", "ru", "pl", "nl", "sv", "tr", "uk"];

describe("linkEntries — armor sets", () => {
  const disciple = [
    makeEntry("DiscipleHelmet", "armor", { name: loc({ zh: "修行者面具", en: "Disciple mask" }) }),
    makeEntry("DiscipleChest", "armor", { name: loc({ zh: "修行者長袍", en: "Disciple Robe" }) }),
    makeEntry("DiscipleHelmet_Unique", "armor", { name: loc({ zh: "賢者頭帶", en: "Sage Headband" }) }),
    makeEntry("DiscipleChest_Unique", "armor", { name: loc({ zh: "賢者短袍", en: "Sage Tunic" }) }),
  ];

  it("groups pieces into normal and unique sets named by their common prefix", () => {
    const { armorSets, issues } = linkEntries(disciple);
    expect(armorSets).toEqual([
      {
        id: "Disciple",
        slug: "disciple",
        variant: "normal",
        name: loc({ zh: "修行者", en: "Disciple" }),
        untranslated: LATER_LANGS,
        pieces: { helmet: "disciple-helmet", chest: "disciple-chest" },
      },
      {
        id: "Disciple_Unique",
        slug: "disciple-unique",
        variant: "unique",
        name: loc({ zh: "賢者", en: "Sage" }),
        untranslated: LATER_LANGS,
        pieces: { helmet: "disciple-helmet-unique", chest: "disciple-chest-unique" },
      },
    ]);
    expect(issues).toEqual([]);
  });

  it("links each piece to its set", () => {
    const { entries } = linkEntries(disciple);
    expect(find(entries, "DiscipleChest_Unique")?.links).toMatchObject({ armorSet: "disciple-unique" });
  });

  it("lists only pieces that exist", () => {
    const { armorSets } = linkEntries(disciple);
    expect(Object.keys(armorSets[0].pieces)).toEqual(["helmet", "chest"]);
  });

  it("falls back to the set id for a single-piece set", () => {
    const { armorSets, issues } = linkEntries([
      makeEntry("WolfclutchHelmet_Unique", "armor", { name: loc({ zh: "狼爪頭盔", en: "Wolf Helm" }) }),
    ]);
    expect(armorSets[0].name).toEqual(loc({ zh: "Wolfclutch (Unique)", en: "Wolfclutch (Unique)" }));
    expect(issues).toEqual([{ type: "armor-set-name-fallback", detail: "Wolfclutch_Unique" }]);
  });

  it("leaves upcoming armor out of sets", () => {
    const { armorSets } = linkEntries([makeEntry("TimewornHelmet", "armor", { release: "upcoming" })]);
    expect(armorSets).toEqual([]);
  });
});

describe("set naming helpers", () => {
  it("computes the common prefix", () => {
    expect(commonPrefix([])).toBe("");
    expect(commonPrefix(["abc", "abd"])).toBe("ab");
  });

  it("cuts English names back to a word boundary", () => {
    expect(setNameFor("en", ["Scamp Hat", "Scamp Hood"])).toBe("Scamp");
    expect(setNameFor("en", ["Hat", "Hood"])).toBeUndefined();
  });

  it("drops a trailing 之 in Chinese names", () => {
    expect(setNameFor("zh", ["狂化隙浮特之爪", "狂化隙浮特之牙"])).toBe("狂化隙浮特");
  });
});
