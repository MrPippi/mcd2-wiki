import { describe, expect, it } from "vitest";
import {
  FusionRowSchema,
  StatusRowSchema,
  buildStatusData,
  statusTagsIn,
  type SourceRow,
  type StatusRow,
  type StatusTables,
} from "../../../scripts/extract/statuses";
import { makeEntry } from "../../helpers/entries";

const tags = (...names: string[]) => ({ GameplayTags: names.map((TagName) => ({ TagName })) });
const text = (table: string, key: string) => ({
  Texts: { '(TagName="SW.TextEntry.Name")': { Text: `LOCTABLE("${table}.csv", "${key}_SW_TextEntry_Name")` } },
});
const scalable = (Value: number) => ({ MagnitudeCalculationType: "ScalableFloat", ScalableFloatMagnitude: { Value } });
const modifier = (AttributeName: string, ModifierOp: string, magnitude: Record<string, unknown>) => ({ Attribute: { AttributeName }, ModifierOp, ModifierMagnitude: magnitude });

const status = (name: string, locId: string | undefined, fields: Record<string, unknown> = {}): StatusRow =>
  StatusRowSchema.parse({
    Name: name,
    TypeTag: { TagName: `SW.Status.${name}` },
    ...(locId ? { TypeTextData: text("DT_StatusDefinition", `SW_Status_${locId}`) } : {}),
    StatusData: { DefaultDuration: 4 },
    GameplayEffect: {},
    ...fields,
  });

const BURNING = status("Burning", "Burning", {
  Traits: tags("SW.Status.NonStacking", "SW.Status.Alignment.Negative"),
  GameplayEffect: { Modifiers: [modifier("Health", "AddBase", { MagnitudeCalculationType: "CustomCalculationClass" })] },
});
const CONDUCTIVE = status("Conductive", "Conductive", {
  Traits: tags("SW.Status.Alignment.Negative"),
  StatusData: { DefaultDuration: 8 },
  GameplayEffect: {
    Modifiers: [
      modifier("MovementSpeedMultiplier", "MultiplyAdditive", scalable(1.2)),
      modifier("BaseDamageResistanceMultiplier", "MultiplyAdditive", scalable(1.25)),
    ],
  },
});
const BURNING_INFINITE = status("BurningInfinite", "Burning_Infinite", { StatusData: { DefaultDuration: -1 } });
const SLOWED = status("Slowed", "Slowed", { TypeTag: { TagName: "SW.Status.Slowed" } });
const OVERLOAD = status("Overload", "Overload");

const FUSION = FusionRowSchema.parse({
  Name: "Overload",
  TypeTag: { TagName: "SW.Status.Overload" },
  FusionDefinitions: {
    PossibleFusions: [tags("SW.Status.Burning", "SW.Status.Conductive")],
    bIsNegativeFusion: true,
    StatusImmunityDuration: 2.3,
  },
});

const source = (table: string, row: Record<string, unknown>): SourceRow => ({ table, row: row as SourceRow["row"] });
const keyValues = (...names: string[]) => ({ SpecificKeyValues: [{ GameplayTagContainer: { ...tags(...names), ParentTags: [{ TagName: "SW.Status" }] } }] });

const ENTRIES = [
  makeEntry("Burning", "status"),
  makeEntry("Burning_Infinite", "status"),
  makeEntry("Conductive", "status"),
  makeEntry("Slowed", "status"),
  makeEntry("Artifact_Satchel_Fire", "artifact"),
  makeEntry("MaulerDive", "enchantment"),
  makeEntry("StatusOnHit_Strength", "effect"),
];

const tables = (sources: SourceRow[] = []): StatusTables => ({
  statuses: [BURNING, CONDUCTIVE, BURNING_INFINITE, SLOWED, OVERLOAD],
  fusions: [FUSION],
  sources,
});

const build = (sources: SourceRow[] = [], mobSlugs: ReadonlyMap<string, string> = new Map()) =>
  buildStatusData(tables(sources), { entries: ENTRIES, mobSlugs });
const info = (result: ReturnType<typeof build>, slug: string) => result.data.statuses.find((one) => one.slug === slug);

describe("statusTagsIn", () => {
  it("finds status tags anywhere but in parent tags and perception filters", () => {
    const row = {
      Abilities: [{ SpecificKeyValues: [{ GameplayTag: { TagName: "SW.Status.Burning" } }] }],
      Traits: { ParentTags: [{ TagName: "SW.Status.Freezing" }] },
      PerceptionConfiguration: { IgnoreActorsWithTags: tags("SW.Status.ShadowForm") },
      Other: "SW.Item.Thing",
    };
    expect(statusTagsIn(row)).toEqual(["SW.Status.Burning"]);
  });
});

describe("buildStatusData", () => {
  it("reads alignment, stacking, duration and the modifiers it can show", () => {
    const result = build();
    expect(info(result, "conductive")).toMatchObject({
      alignment: "negative",
      nonStacking: false,
      duration: 8,
      modifiers: [
        { attribute: "movementSpeed", op: "multiply", value: 1.2 },
        { attribute: "damageTaken", op: "multiply", value: 1.25 },
      ],
    });
    expect(info(result, "burning")).toMatchObject({ alignment: "negative", nonStacking: true, duration: 4, modifiers: [] });
    expect(result.issues).toContainEqual({ type: "status-ignored", detail: "Burning: Health AddBase CustomCalculationClass" });
  });

  it("writes a duration of -1 as null and leaves out rows without a status entry", () => {
    const result = build();
    expect(info(result, "burning-infinite")?.duration).toBeNull();
    expect(result.data.statuses.map((one) => one.slug)).not.toContain("overload");
  });

  it("puts a fusion on both statuses", () => {
    const result = build();
    expect(info(result, "burning")?.fusions).toEqual([{ with: "conductive", result: "Overload", negative: true, immunity: 2.3 }]);
    expect(info(result, "conductive")?.fusions).toEqual([{ with: "burning", result: "Overload", negative: true, immunity: 2.3 }]);
  });

  it("links source rows by loc id, Unique fallback, template effect and mob tag, walking up unknown status tags", () => {
    const result = build(
      [
        source("DT_ItemDefinitionArtifact", { Name: "FireSatchel", TypeTextData: text("DT_ItemDefinitionArtifact", "SW_Item_Artifact_Satchel_Fire"), Abilities: [keyValues("SW.Status.Burning")] }),
        source("DT_EnchantmentDefinition", { Name: "MaulerDive.Unique", Abilities: [keyValues("SW.Status.Conductive")] }),
        source("DT_EffectTemplateDefinition", { Name: "Strike.Unique", TemplateData: { Effect: { TagName: "SW.Effect.StatusOnHit.Strength" } }, Abilities: [keyValues("SW.Status.Slowed.Slime")] }),
        source("DT_MobType1Definition", { Name: "SlimeLarge", TypeTag: { TagName: "SW.Mob.Slime.Large" }, Abilities: [keyValues("SW.Status.Slowed.Slime")] }),
        source("DT_MobType1Definition", { Name: "Nobody", TypeTag: { TagName: "SW.Mob.Nobody" }, Abilities: [keyValues("SW.Status.Burning")] }),
      ],
      new Map([["sw.mob.slime.large", "slime"]]),
    );
    expect(info(result, "burning")?.sources).toEqual([{ kind: "artifact", slug: "satchel-fire" }]);
    expect(info(result, "conductive")?.sources).toEqual([{ kind: "enchantment", slug: "mauler-dive" }]);
    expect(info(result, "slowed")?.sources).toEqual([{ kind: "effect", slug: "status-on-hit-strength" }, { kind: "mob", slug: "slime" }]);
    expect(result.issues).toContainEqual({ type: "status-source-unlinked", detail: "DT_MobType1Definition: Nobody" });
  });
});
