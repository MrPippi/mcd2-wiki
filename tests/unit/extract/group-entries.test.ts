import { describe, expect, it } from "vitest";
import type { TableSource } from "../../../scripts/extract/config";
import { groupEntries, resolveText } from "../../../scripts/extract/group-entries";
import { makeLocales, ns } from "../../helpers/locales";

const MELEE: TableSource = { namespace: ns("DT_ItemDefinitionMelee"), category: "melee", release: "base" };
const R3_MELEE: TableSource = { namespace: ns("DT_R3ItemDefinitionMelee"), category: "melee", release: "upcoming" };
const ENCHANT: TableSource = { namespace: ns("DT_EnchantmentDefinition"), category: "enchantment", release: "base" };
const EFFECT: TableSource = { namespace: ns("DT_EffectDefinition"), category: "effect", release: "base" };

describe("groupEntries", () => {
  it("merges the name and description of one id into one entry", () => {
    const locales = makeLocales({
      [MELEE.namespace]: {
        SW_Item_Sword_SW_TextEntry_Name: ["Sword", "劍"],
        SW_Item_Sword_SW_TextEntry_Description: ["A classic sword.", "經典的劍。"],
      },
    });
    const { entries, issues } = groupEntries(locales, [MELEE]);
    expect(entries).toEqual([
      {
        id: "Sword",
        category: "melee",
        release: "base",
        name: { en: "Sword", zh: "劍" },
        description: { en: "A classic sword.", zh: "經典的劍。" },
        untranslated: [],
      },
    ]);
    expect(issues).toEqual([]);
  });

  it("keeps unique variants as separate entries", () => {
    const locales = makeLocales({
      [MELEE.namespace]: {
        SW_Item_Sword_SW_TextEntry_Name: ["Sword", "劍"],
        SW_Item_Sword_Unique1_SW_TextEntry_Name: ["The Burning Blade", "燃燒之刃"],
      },
    });
    expect(groupEntries(locales, [MELEE]).entries.map((e) => e.id)).toEqual(["Sword", "Sword_Unique1"]);
  });

  it("takes the release from the table", () => {
    const locales = makeLocales({ [R3_MELEE.namespace]: { SW_Item_Halberd_SW_TextEntry_Name: ["Halberd", "戟"] } });
    expect(groupEntries(locales, [R3_MELEE]).entries[0].release).toBe("upcoming");
  });

  it("falls back to English and flags zh as untranslated when zh is empty", () => {
    const locales = makeLocales({ [MELEE.namespace]: { SW_Item_Sword_SW_TextEntry_Name: ["Sword", ""] } });
    const { entries, issues } = groupEntries(locales, [MELEE]);
    expect(entries[0].name).toEqual({ en: "Sword", zh: "Sword" });
    expect(entries[0].untranslated).toEqual(["zh"]);
    expect(issues).toContainEqual({ type: "untranslated", detail: "melee:Sword (zh)" });
  });

  it("treats a zh text equal to its key as untranslated", () => {
    const key = "SW_Item_Sword_SW_TextEntry_Name";
    const locales = makeLocales({ [MELEE.namespace]: { [key]: ["Sword", key] } });
    expect(groupEntries(locales, [MELEE]).entries[0].untranslated).toEqual(["zh"]);
  });

  it("skips keys without an id and reports them", () => {
    const locales = makeLocales({
      [ENCHANT.namespace]: { SW_Enchantment_SW_TextEntry_Name_Tiered: ["{0} {1}", "{0} {1}"] },
    });
    const { entries, issues } = groupEntries(locales, [ENCHANT]);
    expect(entries).toEqual([]);
    expect(issues).toContainEqual({
      type: "skipped-key",
      detail: `${ENCHANT.namespace} › SW_Enchantment_SW_TextEntry_Name_Tiered`,
    });
  });

  it("parses keys with a lowercase Sw_ prefix", () => {
    const locales = makeLocales({ [EFFECT.namespace]: { Sw_Effect_Taunter_SW_TextEntry_Name: ["Taunter", "嘲諷者"] } });
    expect(groupEntries(locales, [EFFECT]).entries.map((e) => e.id)).toEqual(["Taunter"]);
  });

  it("ignores EffectTotal fields", () => {
    const locales = makeLocales({
      [EFFECT.namespace]: {
        SW_Effect_CriticalEdge_SW_TextEntry_Name: ["Critical Edge", "致命鋒刃"],
        SW_Effect_CriticalEdge_SW_TextEntry_Description_EffectTotal: ["{0}", "{0}"],
      },
    });
    const { entries, issues } = groupEntries(locales, [EFFECT]);
    expect(Object.keys(entries[0])).toEqual(["id", "category", "release", "untranslated", "name"]);
    expect(issues).toContainEqual({ type: "ignored-field", detail: "CriticalEdge.Description_EffectTotal" });
  });

  it("drops descriptions that contain only placeholders", () => {
    const locales = makeLocales({
      [EFFECT.namespace]: {
        SW_Effect_Aim_SW_TextEntry_Name: ["Aim", "瞄準"],
        SW_Effect_Aim_SW_TextEntry_Description: ["{0}", " {0} "],
      },
    });
    const { entries, issues } = groupEntries(locales, [EFFECT]);
    expect(entries[0].description).toBeUndefined();
    expect(issues).toContainEqual({ type: "placeholder-only", detail: "Aim.Description" });
  });

  it("keeps descriptions that mix text and placeholders", () => {
    const locales = makeLocales({
      [EFFECT.namespace]: {
        SW_Effect_CriticalEdge_SW_TextEntry_Name: ["Critical Edge", "致命鋒刃"],
        SW_Effect_CriticalEdge_SW_TextEntry_Description: ["Deal {0} more.", "提高 {0}。"],
      },
    });
    expect(groupEntries(locales, [EFFECT]).entries[0].description).toEqual({ en: "Deal {0} more.", zh: "提高 {0}。" });
  });

  it("keeps the unlock explanation of cosmetics", () => {
    const CAPE: TableSource = { namespace: ns("DT_ItemDefinitionCape"), category: "cape", release: "base" };
    const locales = makeLocales({
      [CAPE.namespace]: {
        SW_Item_Cosmetic_Cape_Hero_SW_TextEntry_Name: ["Hero Cape", "英雄披風"],
        SW_Item_Cosmetic_Cape_Hero_SW_TextEntry_UnlockExplanation: ["Upgrade to Deluxe.", "升級至豪華版。"],
      },
    });
    expect(groupEntries(locales, [CAPE]).entries[0].unlock).toEqual({ en: "Upgrade to Deluxe.", zh: "升級至豪華版。" });
  });

  it("drops developer placeholder descriptions", () => {
    const TALISMAN: TableSource = { namespace: ns("DT_ItemDefinitionTalisman"), category: "talisman", release: "base" };
    const locales = makeLocales({
      [TALISMAN.namespace]: {
        SW_Item_Talisman_AmmoCapacity_SW_TextEntry_Name: ["Twig of Dark Oak", "黑橡木枝條"],
        SW_Item_Talisman_AmmoCapacity_SW_TextEntry_Description: [
          "Ammo Capacity Talisman Description",
          "Ammo Capacity Talisman Description",
        ],
      },
    });
    const { entries, issues } = groupEntries(locales, [TALISMAN]);
    expect(entries[0].description).toBeUndefined();
    expect(issues).toContainEqual({ type: "placeholder-only", detail: "Talisman_AmmoCapacity.Description" });
  });

  it("skips entries that have no name", () => {
    const locales = makeLocales({
      [MELEE.namespace]: { SW_Item_Ghost_SW_TextEntry_Description: ["Boo.", "嚇。"] },
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
      [EFFECT.namespace]: { SW_Effect_Aim_SW_TextEntry_Name: ["Aim", "瞄準"] },
      [MELEE.namespace]: {
        SW_Item_Sword_SW_TextEntry_Name: ["Sword", "劍"],
        SW_Item_Axe_SW_TextEntry_Name: ["Axe", "斧"],
      },
    });
    const { entries } = groupEntries(locales, [EFFECT, MELEE]);
    expect(entries.map((e) => `${e.category}:${e.id}`)).toEqual(["melee:Axe", "melee:Sword", "effect:Aim"]);
  });
});

describe("resolveText", () => {
  it("returns no text when both languages are missing", () => {
    expect(resolveText("K", "", undefined)).toEqual({ untranslated: [] });
  });

  it("falls back to zh when en is missing", () => {
    expect(resolveText("K", "", "劍")).toEqual({ text: { zh: "劍", en: "劍" }, untranslated: ["en"] });
  });
});
