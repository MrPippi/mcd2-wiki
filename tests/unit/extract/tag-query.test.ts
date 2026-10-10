import { describe, expect, it } from "vitest";
import { matchesTagQuery, type TagQuery } from "../../../scripts/extract/tag-query";

const query = (tags: string[], stream: number[]): TagQuery => ({
  TagDictionary: tags.map((TagName) => ({ TagName })),
  QueryTokenStream: stream,
});

const MELEE = new Set(["SW.Item.Property.MeleeWeapon", "SW.Archetype.Fighter"]);
const QUIVER = new Set(["SW.Item.Property.Artifact", "SW.Item.Artifact.Quiver.Fire"]);

describe("matchesTagQuery", () => {
  it("matches ANY of a tag list", () => {
    const anyArmorOrMelee = query(["SW.Item.Property.Armor", "SW.Item.Property.MeleeWeapon"], [0, 1, 1, 2, 0, 1]);
    expect(matchesTagQuery(anyArmorOrMelee, MELEE)).toBe(true);
    expect(matchesTagQuery(anyArmorOrMelee, QUIVER)).toBe(false);
  });

  it("matches ALL and NONE of a tag list", () => {
    expect(matchesTagQuery(query(["SW.Item.Property.MeleeWeapon", "SW.Archetype.Fighter"], [0, 1, 2, 2, 0, 1]), MELEE)).toBe(true);
    expect(matchesTagQuery(query(["SW.Item.Property.Armor"], [0, 1, 3, 1, 0]), MELEE)).toBe(true);
  });

  it("treats a query tag as matching its child tags", () => {
    expect(matchesTagQuery(query(["SW.Item.Artifact.Quiver"], [0, 1, 1, 1, 0]), QUIVER)).toBe(true);
  });

  it("nests expressions: ALL( ANY(armor, melee, artifact), NONE(quiver) )", () => {
    const tags = ["SW.Item.Property.Armor", "SW.Item.Property.MeleeWeapon", "SW.Item.Property.Artifact", "SW.Item.Artifact.Quiver"];
    const nested = query(tags, [0, 1, 5, 2, 1, 3, 0, 1, 2, 3, 1, 3]);
    expect(matchesTagQuery(nested, MELEE)).toBe(true);
    expect(matchesTagQuery(nested, QUIVER)).toBe(false);
  });

  it("matches nothing when the query has no root expression", () => {
    expect(matchesTagQuery(query([], [0, 0]), MELEE)).toBe(false);
  });
});
