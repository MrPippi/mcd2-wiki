import { describe, expect, it } from "vitest";
import { combineGroup, groupTemplates, inheritedTags, poolGroups, poolTags, withParents } from "../../../scripts/extract/affix-pool";
import { AFFIX_TABLES } from "../../helpers/affix-tables";

const ETG = (name: string) => `SW.EffectTemplateGroup.${name}`;
const AXE = ["SW.Item.Property.MeleeWeapon", "SW.Item.Property.MediumWeapon", "SW.Archetype.Ranger"];

describe("poolTags", () => {
  it("adds the parents of every tag and the gear tag, last", () => {
    const tags = [...poolTags(["SW.Item.Property.Armor.Boots"])];
    expect(tags).toEqual(expect.arrayContaining(["SW.Item.Property.Armor.Boots", "SW.Item.Property.Armor", "SW.Item.Property", "SW"]));
    expect(tags.at(-1)).toBe("SW.Item.Property.Gear");
  });

  it("lists a tag once", () => {
    expect([...withParents(["A.B", "A.B.C"])]).toEqual(["A", "A.B", "A.B.C"]);
  });
});

describe("poolGroups", () => {
  it("collects the groups of every drop table row the item's tags match", () => {
    expect(Object.fromEntries(poolGroups(poolTags(AXE), AFFIX_TABLES))).toEqual({
      [ETG("Weapon")]: 1,
      [ETG("Archetype.Ranger")]: 1,
      [ETG("Archetype.Utility")]: 0.25,
    });
  });

  it("lets the gear row's Set win over the Utility archetype's (Mushroom armor rolls the Utility group at 0.25)", () => {
    expect(poolGroups(poolTags(["SW.Archetype.Utility"]), AFFIX_TABLES).get(ETG("Archetype.Utility"))).toBe(0.25);
  });

  it("reads SecondaryETG like PrimaryETG", () => {
    const tables = { ...AFFIX_TABLES, dropTable: [{ TypeTag: { TagName: "SW.Item.Property.Gear" }, PrimaryETG: {}, SecondaryETG: { Tags: [{ TypeTag: { TagName: ETG("Armor") }, Weight: 2, Operation: "Set" }] } }] };
    expect(poolGroups(poolTags([]), tables).get(ETG("Armor"))).toBe(2);
  });
});

describe("combineGroup", () => {
  it("is (Set + Add) x Multiply with the last Set, and never below 0", () => {
    expect(combineGroup([{ operation: "set", weight: 1 }, { operation: "set", weight: 0.25 }])).toBe(0.25);
    expect(combineGroup([{ operation: "set", weight: 1 }, { operation: "add", weight: 0.5 }, { operation: "multiply", weight: 0.5 }])).toBe(0.75);
    expect(combineGroup([{ operation: "add", weight: -2 }])).toBe(0);
    expect(combineGroup([])).toBe(0);
  });
});

describe("groupTemplates", () => {
  const opsOf = (tags: readonly string[], template: string) =>
    groupTemplates(poolGroups(poolTags(tags), AFFIX_TABLES), AFFIX_TABLES).find((found) => found.template === `SW.EffectTemplate.${template}`)?.ops;

  it("scales Set entries by the pool group's weight", () => {
    expect(opsOf(AXE, "Looting.I")).toEqual([["set", 0.25]]);
    expect(opsOf(AXE, "CriticalEdge.II")).toEqual([["set", 0.75]]);
  });

  it("keeps an entry from every group that lists the template", () => {
    expect(opsOf(AXE, "Power.I")).toEqual([["set", 1], ["set", 1]]);
  });

  it("does not scale Multiply entries by the group's weight", () => {
    expect(opsOf([...AXE, "SW.Item.Property.Elemental.Fire"], "Sharpness.III")).toEqual([["set", 1], ["multiply", 0.5], ["multiply", 0.5]]);
  });

  it("lists nothing for templates no pool group has", () => {
    expect(opsOf(AXE, "Cooldown.I")).toBeUndefined();
  });
});

describe("inheritedTags", () => {
  const row = (tag: string, ...traits: string[]) => ({ Name: tag, TypeTag: { TagName: tag }, Traits: { GameplayTags: traits.map((TagName) => ({ TagName })) } });

  it("adds the traits of the row whose tag the item carries, following parents to the end", () => {
    const rows = [
      row("SW.Item.Artifact.Quiver", "SW.Archetype.Ranger", "SW.Item.Artifact.Base"),
      row("SW.Item.Artifact.Base", "SW.Item.Property.Artifact"),
      row("SW.Item.Artifact.FlameQuiver", "SW.Item.Artifact.Quiver", "SW.Item.Property.Elemental.Fire"),
    ];
    expect(inheritedTags(rows[2], rows)).toEqual([
      "SW.Item.Artifact.Quiver",
      "SW.Archetype.Ranger",
      "SW.Item.Artifact.Base",
      "SW.Item.Property.Artifact",
      "SW.Item.Property.Elemental.Fire",
    ]);
  });

  it("stops at a cycle", () => {
    const rows = [row("A", "B"), row("B", "A")];
    expect(inheritedTags(rows[0], rows)).toEqual(["B", "A"]);
  });
});
