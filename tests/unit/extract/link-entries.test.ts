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

/** Real Disciple helmet and chest names, so every writing system meets its real shape. */
const DISCIPLE_HELMET = {
  zh: "修行者面具", "zh-hans": "门徒面具", en: "Disciple mask", ja: "門弟のマスク", ko: "수련자 가면", de: "Anhängermaske",
  fr: "Masque du disciple", es: "Máscara de discípulo", it: "Maschera del discepolo", pt: "Máscara do Discípulo",
  ru: "Маска послушника", pl: "Maska adepta", nl: "Masker van de discipel", sv: "Lärjungemask", tr: "Mürit Maskesi", uk: "Маска учня",
};
const DISCIPLE_CHEST = {
  zh: "修行者長袍", "zh-hans": "门徒长袍", en: "Disciple Robe", ja: "門弟のローブ", ko: "수련자 로브", de: "Anhängerumhang",
  fr: "Robe du disciple", es: "Túnica de discípulo", it: "Veste del discepolo", pt: "Robe do Discípulo",
  ru: "Одеяние послушника", pl: "Szata adepta", nl: "Discipelgewaad", sv: "Lärjungedräkt", tr: "Mürit Cübbesi", uk: "Мантія учня",
};

describe("linkEntries — armor sets", () => {
  const disciple = [
    makeEntry("DiscipleHelmet", "armor", { name: loc(DISCIPLE_HELMET) }),
    makeEntry("DiscipleChest", "armor", { name: loc(DISCIPLE_CHEST) }),
    makeEntry("DiscipleHelmet_Unique", "armor", { name: loc({ zh: "賢者頭帶", en: "Sage Headband" }) }),
    makeEntry("DiscipleChest_Unique", "armor", { name: loc({ zh: "賢者短袍", en: "Sage Tunic" }) }),
  ];

  it("names a set in each language by its own writing-system rule and falls back to English otherwise", () => {
    const { armorSets, issues } = linkEntries(disciple);
    expect(armorSets[0]).toEqual({
      id: "Disciple",
      slug: "disciple",
      variant: "normal",
      name: loc({ zh: "修行者", "zh-hans": "门徒", en: "Disciple", ja: "門弟", ko: "수련자" }),
      untranslated: ["de", "fr", "es", "it", "pt", "ru", "pl", "nl", "sv", "tr", "uk"],
      pieces: { helmet: "disciple-helmet", chest: "disciple-chest" },
    });
    expect(issues).toEqual([]);
  });

  it("names a German set once its piece tails recur in two sets", () => {
    const set = (prefix: string, de: string) => [
      makeEntry(prefix + "Helmet", "armor", { name: loc({ zh: prefix + "頭盔", en: prefix + " Helm", de: de + "helm" }) }),
      makeEntry(prefix + "Chest", "armor", { name: loc({ zh: prefix + "長袍", en: prefix + " Robe", de: de + "robe" }) }),
    ];
    const { armorSets } = linkEntries([...set("Alpha", "Alpha"), ...set("Beta", "Beta"), ...set("Gamma", "Gamma"), ...set("Delta", "Delta")]);
    expect(armorSets.map((entry) => entry.name.de)).toEqual(["Alpha", "Beta", "Delta", "Gamma"]);
    expect(armorSets.every((entry) => !entry.untranslated?.includes("de"))).toBe(true);
    const lonely = linkEntries(set("Alpha", "Alpha")).armorSets;
    expect(lonely.every((entry) => entry.untranslated?.includes("de"))).toBe(true);
  });

  it("does not name a set from English text that stands in for missing translations", () => {
    const flagged = (id: string, zh: string, en: string) => makeEntry(id, "armor", { name: loc({ zh, en }), untranslated: ["ja"] });
    const { armorSets } = linkEntries([
      flagged("DiscipleHelmet", "修行者面具", "Disciple mask"),
      flagged("DiscipleChest", "修行者長袍", "Disciple Robe"),
    ]);
    expect(armorSets[0].name.ja).toBe("Disciple");
    expect(armorSets[0].untranslated).toContain("ja");
    expect(armorSets[0].untranslated).not.toContain("zh");
  });

  it("names the unique set from the pieces' common prefix", () => {
    const { armorSets } = linkEntries(disciple);
    expect(armorSets[1]).toMatchObject({
      id: "Disciple_Unique",
      slug: "disciple-unique",
      variant: "unique",
      name: loc({ zh: "賢者", en: "Sage" }),
      pieces: { helmet: "disciple-helmet-unique", chest: "disciple-chest-unique" },
    });
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

describe("setNameFor — per writing system", () => {
  const names = (lang: keyof typeof DISCIPLE_HELMET) => [DISCIPLE_HELMET[lang], DISCIPLE_CHEST[lang]];
  it("cuts Latin names at a word boundary", () => {
    expect(setNameFor("en", names("en"))).toBe("Disciple");
    expect(setNameFor("tr", names("tr"), new Set(["maskesi", "cübbesi"]))).toBe("Mürit");
    expect(setNameFor("pl", names("pl"))).toBeUndefined();
  });

  it("falls back for Swedish whatever the names share", () => {
    expect(setNameFor("sv", ["Lärjungemask", "Lärjungedräkt"])).toBeUndefined();
    expect(setNameFor("sv", ["Sculkgrävarens hjälm", "Sculkgrävarens rustning"])).toBeUndefined();
  });

  it("rejects a prefix whose piece remainder is not a known tail", () => {
    const known = new Set(["helm", "robe"]);
    expect(setNameFor("de", ["Stahlwollkappe", "Stahlwollpullover"], known)).toBeUndefined();
    expect(setNameFor("nl", ["Dolle Sifterhelm", "Dolle Siftercape"], new Set(["helm"]))).toBeUndefined();
    expect(setNameFor("nl", ["Dolle helm", "Dolle robe"], known)).toBe("Dolle");
  });

  it("rejects a Cyrillic prefix that ends like an adjective", () => {
    expect(setNameFor("ru", ["Чудовищные шлем", "Чудовищные латы"])).toBeUndefined();
    expect(setNameFor("uk", ["Лісовий шолом", "Лісовий плащ"])).toBeUndefined();
    expect(setNameFor("ru", ["Монарх шлем", "Монарх латы"], new Set(["шлем", "латы"]))).toBe("Монарх");
  });

  it("rejects a German prefix that ends in an inflection", () => {
    const known = new Set(["helm", "robe"]);
    expect(setNameFor("de", ["Nomadenhelm", "Nomadenrobe"], known)).toBeUndefined();
    expect(setNameFor("de", ["Pilzhelm", "Pilzrobe"], known)).toBe("Pilz");
  });

  it("allows a German compound prefix of 4+ letters followed by letters", () => {
    const known = new Set(["helm", "robe", "maske", "umhang"]);
    expect(setNameFor("de", names("de"), known)).toBe("Anhänger");
    expect(setNameFor("de", ["Jüngerhelm", "Jüngerrobe"], known)).toBe("Jünger");
    expect(setNameFor("de", ["Abc", "Abcd"])).toBeUndefined();
    expect(setNameFor("de", ["Sifter-Helm", "Sifter-Robe"], known)).toBe("Sifter");
    expect(setNameFor("de", ["Jünger Helm", "Jünger Robe"])).toBe("Jünger");
  });

  it("returns nothing for Cyrillic names without a shared word", () => {
    expect(setNameFor("ru", names("ru"))).toBeUndefined();
    expect(setNameFor("uk", names("uk"))).toBeUndefined();
  });

  it("drops the trailing connector of CJK names", () => {
    expect(setNameFor("zh", names("zh"))).toBe("修行者");
    expect(setNameFor("zh-hans", names("zh-hans"))).toBe("门徒");
    expect(setNameFor("ja", names("ja"))).toBe("門弟");
    expect(setNameFor("ko", names("ko"))).toBe("수련자");
  });

  it("accepts a cut inside a katakana run only when every piece remainder is a known tail", () => {
    const known = new Set(["キャップ", "セーター", "レギンス", "ブーツ"]);
    const wool = ["スチールウールキャップ", "スチールウールセーター", "スチールウールレギンス", "スチールウールブーツ"];
    expect(setNameFor("ja", wool, known)).toBe("スチールウール");
    expect(setNameFor("ja", wool, new Set(["レギンス", "ブーツ"]))).toBeUndefined();
    expect(setNameFor("ja", ["ハイヴマインドのヘルメット", "ハイブマインドの胸当て"], known)).toBeUndefined();
    expect(setNameFor("ja", ["ハイヴマインドのヘルメット", "ハイブマインドの胸当て"])).toBe("ハイ");
    expect(setNameFor("zh", ["狂化隙浮特之爪", "狂化隙浮特之牙"], known)).toBe("狂化隙浮特");
    expect(setNameFor("ja", ["ハイブマインドのヘルメット", "ハイブマインドの胸当て"])).toBe("ハイブマインド");
  });

  it("rejects a name shorter than 2 characters or equal to a piece name", () => {
    expect(setNameFor("zh", ["甲冑", "甲衣"])).toBeUndefined();
    expect(setNameFor("en", ["Scamp", "Scamp Hood"])).toBeUndefined();
  });
});
