import { describe, expect, it } from "vitest";
import { buildAffixModels, modelsByHash } from "../../../scripts/extract/affix-models";
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

describe("model hashes and skipped items", () => {
  it("uses 16-hex hashes and stops when two different pools share one", () => {
    const { data } = buildAffixModels(ENTRIES, AFFIX_TABLES, THREAT, RARITIES);
    expect(Object.keys(data.models).every((hash) => /^[0-9a-f]{16}$/.test(hash))).toBe(true);
    const one = [{ effect: "a", tier: 1 as const, ops: [["set", 1]] as [["set", number]] }];
    const two = [{ effect: "b", tier: 1 as const, ops: [["set", 1]] as [["set", number]] }];
    expect(Object.keys(modelsByHash([{ hash: "h", model: one }, { hash: "h", model: one }]))).toEqual(["h"]);
    expect(() => modelsByHash([{ hash: "h", model: one }, { hash: "h", model: two }])).toThrow(/share the hash h/);
  });

  it("reports an item left out for an empty pool or no rarity with random effects", () => {
    const noRarity = buildAffixModels(ENTRIES, AFFIX_TABLES, THREAT, [tier("common", 0, null)]);
    expect(noRarity.issues.filter((found) => found.type === "affix-ignored" && /no rarity with random effects/.test(found.detail))).toHaveLength(6);
    const noPool = buildAffixModels(ENTRIES, { ...AFFIX_TABLES, dropTable: [] }, THREAT, RARITIES);
    expect(noPool.issues.some((found) => /axe: no odds table \(empty effect pool/.test(found.detail))).toBe(true);
  });

  it("reports a built-in effect the site has no entry for", () => {
    const { issues } = buildAffixModels(ENTRIES.filter((one) => one.id !== "Reconstruction"), AFFIX_TABLES, THREAT, RARITIES);
    expect(issues.map((found) => found.detail)).toEqual(expect.arrayContaining(["axe-unique1: built-in effect SW.Effect.Reconstruction has no site entry"]));
  });
});

describe("AffixDataSchema", () => {
  const { data } = buildAffixModels(ENTRIES, AFFIX_TABLES, THREAT, RARITIES);
  const failures = (value: unknown) => AffixDataSchema.safeParse(value).error?.issues.map((found) => found.message) ?? [];

  it("rejects unknown fields", () => {
    expect(AffixDataSchema.safeParse({ ...data, extra: 1 }).success).toBe(false);
  });

  it("rejects levels that repeat or run backwards, and factors that do not match them", () => {
    expect(failures({ ...data, levels: [2, 1] }).join()).toMatch(/ascending/);
    expect(failures({ ...data, levels: [1, 1] }).join()).toMatch(/ascending/);
    expect(failures({ ...data, tierFactors: [[1, 0, 0]] }).join()).toMatch(/per threat level/);
  });

  it("rejects an item whose model does not exist", () => {
    expect(failures({ ...data, items: { axe: { ...data.items.axe, model: "nope" } } }).join()).toMatch(/unknown model nope/);
  });

  it("rejects negative or infinite weights and factors", () => {
    const [hash, model] = Object.entries(data.models)[0];
    const withWeight = (weight: number) => ({ ...data, models: { [hash]: { entries: [{ ...model.entries[0], ops: [["set", weight]] }] } }, items: {} });
    expect(AffixDataSchema.safeParse(withWeight(-1)).success).toBe(false);
    expect(AffixDataSchema.safeParse(withWeight(Infinity)).success).toBe(false);
    expect(AffixDataSchema.safeParse({ ...data, tierFactors: [[-1, 0, 0], [1, 0, 0]] }).success).toBe(false);
  });

  it("rejects a rarity with more random effects than the draw supports", () => {
    const item = { ...data.items.axe, rarities: [{ rarity: "rare" as const, slots: 3, bonusSlots: 2 }] };
    expect(failures({ ...data, items: { axe: item } }).join()).toMatch(/at most 4/);
  });
});

