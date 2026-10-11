import { describe, expect, it } from "vitest";
import type { TableSource } from "../../../scripts/extract/config";
import { groupEntries, resolveText } from "../../../scripts/extract/group-entries";
import { makeLocales, ns } from "../../helpers/locales";
import { loc } from "../../helpers/localized";

const MELEE: TableSource = { namespace: ns("DT_ItemDefinitionMelee"), category: "melee", release: "base" };
const R3_MELEE: TableSource = { namespace: ns("DT_R3ItemDefinitionMelee"), category: "melee", release: "upcoming" };
const ENCHANT: TableSource = { namespace: ns("DT_EnchantmentDefinition"), category: "enchantment", release: "base" };
const EFFECT: TableSource = { namespace: ns("DT_EffectDefinition"), category: "effect", release: "base" };

describe("groupEntries", () => {
  it("merges the name and description of one id into one entry", () => {
    const locales = makeLocales({
      [MELEE.namespace]: {
        SW_Item_Sword_SW_TextEntry_Name: { en: "Sword", zh: "劍" },
        SW_Item_Sword_SW_TextEntry_Description: { en: "A classic sword.", zh: "經典的劍。" },
      },
    });
    const { entries, issues } = groupEntries(locales, [MELEE]);
    expect(entries).toEqual([
      {
        id: "Sword",
        category: "melee",
        release: "base",
        name: loc({ en: "Sword", zh: "劍" }),
        description: loc({ en: "A classic sword.", zh: "經典的劍。" }),
        untranslated: [],
      },
    ]);
    expect(issues).toEqual([]);
  });

  it("keeps unique variants as separate entries", () => {
    const locales = makeLocales({
      [MELEE.namespace]: {
        SW_Item_Sword_SW_TextEntry_Name: { en: "Sword", zh: "劍" },
        SW_Item_Sword_Unique1_SW_TextEntry_Name: { en: "The Burning Blade", zh: "燃燒之刃" },
      },
    });
    expect(groupEntries(locales, [MELEE]).entries.map((e) => e.id)).toEqual(["Sword", "Sword_Unique1"]);
  });

  it("takes the release from the table", () => {
    const locales = makeLocales({ [R3_MELEE.namespace]: { SW_Item_Halberd_SW_TextEntry_Name: { en: "Halberd", zh: "戟" } } });
    expect(groupEntries(locales, [R3_MELEE]).entries[0].release).toBe("upcoming");
  });

  it("falls back to English and flags zh as untranslated when zh is empty", () => {
    const locales = makeLocales({ [MELEE.namespace]: { SW_Item_Sword_SW_TextEntry_Name: { en: "Sword", zh: "" } } });
    const { entries, issues } = groupEntries(locales, [MELEE]);
    expect(entries[0].name).toEqual(loc({ en: "Sword" }));
    expect(entries[0].untranslated).toEqual(["zh"]);
    expect(issues).toContainEqual({ type: "untranslated", detail: "melee:Sword (zh)" });
  });

  it("treats a zh text equal to its key as untranslated", () => {
    const key = "SW_Item_Sword_SW_TextEntry_Name";
    const locales = makeLocales({ [MELEE.namespace]: { [key]: { en: "Sword", zh: key } } });
    expect(groupEntries(locales, [MELEE]).entries[0].untranslated).toEqual(["zh"]);
  });

  it("skips keys without an id and reports them", () => {
    const locales = makeLocales({
      [ENCHANT.namespace]: { SW_Enchantment_SW_TextEntry_Name_Tiered: { en: "{0} {1}", zh: "{0} {1}" } },
    });
    const { entries, issues } = groupEntries(locales, [ENCHANT]);
    expect(entries).toEqual([]);
    expect(issues).toContainEqual({
      type: "skipped-key",
      detail: `${ENCHANT.namespace} › SW_Enchantment_SW_TextEntry_Name_Tiered`,
    });
  });

  it("parses keys with a lowercase Sw_ prefix", () => {
    const locales = makeLocales({ [EFFECT.namespace]: { Sw_Effect_Taunter_SW_TextEntry_Name: { en: "Taunter", zh: "嘲諷者" } } });
    expect(groupEntries(locales, [EFFECT]).entries.map((e) => e.id)).toEqual(["Taunter"]);
  });

  it("ignores EffectTotal fields", () => {
    const locales = makeLocales({
      [EFFECT.namespace]: {
        SW_Effect_CriticalEdge_SW_TextEntry_Name: { en: "Critical Edge", zh: "致命鋒刃" },
        SW_Effect_CriticalEdge_SW_TextEntry_Description_EffectTotal: { en: "{0}", zh: "{0}" },
      },
    });
    const { entries, issues } = groupEntries(locales, [EFFECT]);
    expect(Object.keys(entries[0])).toEqual(["id", "category", "release", "untranslated", "name"]);
    expect(issues).toContainEqual({ type: "ignored-field", detail: "CriticalEdge.Description_EffectTotal" });
  });

  it("drops descriptions that contain only placeholders", () => {
    const locales = makeLocales({
      [EFFECT.namespace]: {
        SW_Effect_Aim_SW_TextEntry_Name: { en: "Aim", zh: "瞄準" },
        SW_Effect_Aim_SW_TextEntry_Description: { en: "{0}", zh: " {0} " },
      },
    });
    const { entries, issues } = groupEntries(locales, [EFFECT]);
    expect(entries[0].description).toBeUndefined();
    expect(issues).toContainEqual({ type: "placeholder-only", detail: "Aim.Description" });
  });

  it("judges placeholder-only descriptions by the English text alone", () => {
    const locales = makeLocales({
      [EFFECT.namespace]: {
        SW_Effect_Aim_SW_TextEntry_Name: { en: "Aim", zh: "瞄準" },
        SW_Effect_Aim_SW_TextEntry_Description: { en: "{0}", ja: "{0} アップ" },
      },
    });
    const { entries, issues } = groupEntries(locales, [EFFECT]);
    expect(entries[0].description).toBeUndefined();
    expect(issues).toContainEqual({ type: "placeholder-only", detail: "Aim.Description" });
  });

  it("uses English for a language that lacks the whole namespace and reports it", () => {
    const locales = { ...makeLocales({ [MELEE.namespace]: { SW_Item_Sword_SW_TextEntry_Name: { en: "Sword", zh: "劍" } } }), ja: {} };
    const { entries, issues } = groupEntries(locales, [MELEE]);
    expect(entries[0].name.ja).toBe("Sword");
    expect(entries[0].untranslated).toEqual(["ja"]);
    expect(issues).toContainEqual({ type: "untranslated-namespace", detail: `ja: ${MELEE.namespace}` });
  });

  it("keeps descriptions that mix text and placeholders", () => {
    const locales = makeLocales({
      [EFFECT.namespace]: {
        SW_Effect_CriticalEdge_SW_TextEntry_Name: { en: "Critical Edge", zh: "致命鋒刃" },
        SW_Effect_CriticalEdge_SW_TextEntry_Description: { en: "Deal {0} more.", zh: "提高 {0}。" },
      },
    });
    expect(groupEntries(locales, [EFFECT]).entries[0].description).toEqual(loc({ en: "Deal {0} more.", zh: "提高 {0}。" }));
  });

  it("keeps the unlock explanation of cosmetics", () => {
    const CAPE: TableSource = { namespace: ns("DT_ItemDefinitionCape"), category: "cape", release: "base" };
    const locales = makeLocales({
      [CAPE.namespace]: {
        SW_Item_Cosmetic_Cape_Hero_SW_TextEntry_Name: { en: "Hero Cape", zh: "英雄披風" },
        SW_Item_Cosmetic_Cape_Hero_SW_TextEntry_UnlockExplanation: { en: "Upgrade to Deluxe.", zh: "升級至豪華版。" },
      },
    });
    expect(groupEntries(locales, [CAPE]).entries[0].unlock).toEqual(loc({ en: "Upgrade to Deluxe.", zh: "升級至豪華版。" }));
  });

  it("drops developer placeholder descriptions", () => {
    const TALISMAN: TableSource = { namespace: ns("DT_ItemDefinitionTalisman"), category: "talisman", release: "base" };
    const locales = makeLocales({
      [TALISMAN.namespace]: {
        SW_Item_Talisman_AmmoCapacity_SW_TextEntry_Name: { en: "Twig of Dark Oak", zh: "黑橡木枝條" },
        SW_Item_Talisman_AmmoCapacity_SW_TextEntry_Description: { en: "Ammo Capacity Talisman Description", zh: "Ammo Capacity Talisman Description" },
      },
    });
    const { entries, issues } = groupEntries(locales, [TALISMAN]);
    expect(entries[0].description).toBeUndefined();
    expect(issues).toContainEqual({ type: "placeholder-only", detail: "Talisman_AmmoCapacity.Description" });
  });

  it("skips entries that have no name", () => {
    const locales = makeLocales({
      [MELEE.namespace]: { SW_Item_Ghost_SW_TextEntry_Description: { en: "Boo.", zh: "嚇。" } },
    });
    const { entries, issues } = groupEntries(locales, [MELEE]);
    expect(entries).toEqual([]);
    expect(issues).toContainEqual({ type: "missing-name", detail: "melee:Ghost" });
  });

  it("reports a missing namespace", () => {
    const { entries, issues } = groupEntries(makeLocales({}), [MELEE]);
    expect(entries).toEqual([]);
    expect(issues).toEqual([{ type: "missing-namespace", detail: MELEE.namespace }]);
  });

  it("sorts entries by category order, then id", () => {
    const locales = makeLocales({
      [EFFECT.namespace]: { SW_Effect_Aim_SW_TextEntry_Name: { en: "Aim", zh: "瞄準" } },
      [MELEE.namespace]: {
        SW_Item_Sword_SW_TextEntry_Name: { en: "Sword", zh: "劍" },
        SW_Item_Axe_SW_TextEntry_Name: { en: "Axe", zh: "斧" },
      },
    });
    const { entries } = groupEntries(locales, [EFFECT, MELEE]);
    expect(entries.map((e) => `${e.category}:${e.id}`)).toEqual(["melee:Axe", "melee:Sword", "effect:Aim"]);
  });
});

describe("resolveText", () => {
  it("returns no text when English is missing, whatever the other languages have", () => {
    expect(resolveText("K", { zh: "劍", ja: "剣", en: "" })).toEqual({ untranslated: [] });
    expect(resolveText("K", { zh: "劍" })).toEqual({ untranslated: [] });
  });

  it("uses English for a missing language and flags that language as untranslated", () => {
    const texts = { ...loc({ en: "Sword", zh: "劍" }), ja: "" };
    expect(resolveText("K", texts)).toEqual({ text: loc({ en: "Sword", zh: "劍" }), untranslated: ["ja"] });
  });

  it("flags every language with no text, in language order", () => {
    const { text, untranslated } = resolveText("K", { en: "Sword", ja: "剣", de: "K" });
    expect(text?.ja).toBe("剣");
    expect(text?.de).toBe("Sword");
    expect(untranslated).toEqual(["zh", "zh-hans", "ko", "de", "fr", "es", "it", "pt", "ru", "pl", "nl", "sv", "tr", "uk"]);
  });
});
