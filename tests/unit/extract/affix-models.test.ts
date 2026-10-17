import { describe, expect, it } from "vitest";
import { buildAffixModels } from "../../../scripts/extract/affix-models";
import { AffixDataSchema } from "../../../scripts/extract/affix-schema";
import type { RarityTier, ThreatRow } from "../../../scripts/extract/guides-schema";
import { AFFIX_TABLES } from "../../helpers/affix-tables";
import { makeEntry } from "../../helpers/entries";

const ENTRIES = [
  makeEntry("Axe", "melee"),
  makeEntry("Axe_Unique1", "melee"),
  makeEntry("Bow", "ranged"),
  makeEntry("HunterHelmet", "armor"),
  makeEntry("HunterHelmet_Unique", "armor"),
  makeEntry("Artifact_TotemOfShielding", "artifact", { slug: "totem-of-shielding" }),
  ...["Sharpness", "Power", "CriticalEdge", "Looting", "Cooldown", "Reconstruction"].map((id) => makeEntry(id, "effect")),
];

const tier = (rarity: RarityTier["rarity"], rerollableEffects: number, stormExtraEffects: number | null): RarityTier => ({ rarity, rerollableEffects, stormExtraEffects, itemPowerOffset: 0 });
const RARITIES = [tier("common", 0, null), tier("rare", 1, 1), tier("special", 2, 1), tier("unique", 1, 1)];
const THREAT: ThreatRow[] = [
  { level: 1, effectTiers: [1, 0, 0] },
  { level: 2, effectTiers: [1, 0.5, 0] },
];

describe("buildAffixModels", () => {
  const { data, issues } = buildAffixModels(ENTRIES, AFFIX_TABLES, THREAT, RARITIES);
  const effectsOf = (slug: string) => [...new Set(data.models[data.items[slug].model].entries.map((entry) => entry.effect))].sort();

  it("lists the effects of each pool, left out by the base templates that exclude the item kind", () => {
    expect(effectsOf("axe")).toEqual(["critical-edge", "looting", "sharpness"]);
    expect(effectsOf("bow")).toEqual(["critical-edge", "looting", "power"]);
    expect(effectsOf("hunter-helmet")).toEqual(["looting"]);
    expect(effectsOf("totem-of-shielding")).toEqual(["cooldown", "looting"]);
  });

  it("keeps the weights each entry combines, scaled by the pool group", () => {
    const sharpness = data.models[data.items.axe.model].entries.find((entry) => entry.effect === "sharpness" && entry.tier === 2);
    const looting = data.models[data.items.axe.model].entries.find((entry) => entry.effect === "looting" && entry.tier === 1);
    expect(sharpness?.ops).toEqual([["set", 1]]);
    expect(looting?.ops).toEqual([["set", 0.25]]);
  });

  it("gives normal items Rare and Special, unique pieces Unique, with the rarity's slots and the Soul Storm bonus", () => {
    expect(data.items.axe.rarities).toEqual([
      { rarity: "rare", slots: 1, bonusSlots: 1 },
      { rarity: "special", slots: 2, bonusSlots: 1 },
    ]);
    expect(data.items["axe-unique1"].rarities).toEqual([{ rarity: "unique", slots: 1, bonusSlots: 1 }]);
  });

  it("names a unique item's built-in effect and shares a pool between items with the same one", () => {
    expect(data.items["axe-unique1"].fixed).toEqual(["reconstruction"]);
    expect(data.items.axe.fixed).toEqual([]);
    expect(data.items["axe-unique1"].model).toBe(data.items.axe.model);
    expect(Object.keys(data.models).length).toBeLessThan(Object.keys(data.items).length);
  });

  it("carries the tier factors of the threat levels", () => {
    expect(data.levels).toEqual([1, 2]);
    expect(data.tierFactors).toEqual([[1, 0, 0], [1, 0.5, 0]]);
  });

  it("is valid output and reports nothing for these tables", () => {
    expect(AffixDataSchema.parse(data)).toEqual(data);
    expect(issues).toEqual([]);
  });

  it("leaves out items without a site entry, and items with no random effect", () => {
    expect(Object.keys(data.items).sort()).toEqual(["axe", "axe-unique1", "bow", "hunter-helmet", "hunter-helmet-unique", "totem-of-shielding"]);
    const none = buildAffixModels(ENTRIES, AFFIX_TABLES, THREAT, [tier("common", 0, null)]);
    expect(Object.keys(none.data.items)).toEqual([]);
  });

  it("reports missing tier factors", () => {
    const { issues: missing } = buildAffixModels(ENTRIES, AFFIX_TABLES, [{ level: 1 }], RARITIES);
    expect(missing.map((found) => found.type)).toEqual(["guides-value-missing"]);
  });

  it("reports what it ignores: a secondary pool and a minimum item power", () => {
    const tables = {
      ...AFFIX_TABLES,
      dropTable: [...AFFIX_TABLES.dropTable, { TypeTag: { TagName: "SW.Item.Property.Foo" }, PrimaryETG: {}, SecondaryETG: { Tags: [{ TypeTag: { TagName: "X" }, Weight: 1, Operation: "Set" }] } }],
      templates: AFFIX_TABLES.templates.map((template) =>
        template.TypeTag.TagName === "SW.EffectTemplate.Looting.I" ? { ...template, TemplateData: { ...template.TemplateData, MinimumRequiredItemPower: 5 } } : template,
      ),
    };
    const { issues: found } = buildAffixModels(ENTRIES, tables, THREAT, RARITIES);
    expect(found.map((one) => one.type)).toEqual(["affix-ignored", "affix-ignored"]);
    expect(found.map((one) => one.detail).join("\n")).toMatch(/Foo.*SecondaryETG[\s\S]*Looting\.I.*MinimumRequiredItemPower 5/);
  });
});
