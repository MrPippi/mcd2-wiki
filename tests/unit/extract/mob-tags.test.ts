import { describe, expect, it } from "vitest";
import { normalizeTag, tagKey, traitClosure, type TaggedRow } from "../../../scripts/extract/mob-tags";

const row = (typeTag: string, ...traits: string[]): TaggedRow => ({
  TypeTag: { TagName: typeTag },
  Traits: { GameplayTags: traits.map((TagName) => ({ TagName })) },
});

describe("tag normalization", () => {
  it("treats the game's Sw. typo as SW. and ignores case when comparing", () => {
    expect(normalizeTag("Sw.Mob.ZombieFrozen")).toBe("SW.Mob.ZombieFrozen");
    expect(normalizeTag("SW.Mob.Zombie")).toBe("SW.Mob.Zombie");
    expect(tagKey("Sw.Mob.ZombieFrozen")).toBe(tagKey("SW.MOB.zombiefrozen"));
  });
});

describe("traitClosure", () => {
  it("follows traits through the rows that own those tags, nearest first, without repeats", () => {
    const rows = [
      row("SW.Mob.Default.Hostile", "SW.Mob.Default.Base"),
      row("SW.Mob.Default.MeleeAttackMob", "SW.Mob.Default.Hostile"),
      row("SW.Mob.Default.Base"),
    ];
    const byKey = new Map(rows.map((r) => [tagKey(r.TypeTag.TagName), r]));
    const zombie = row("SW.Mob.Zombie", "SW.Property.Spawnable", "SW.Mob.Default.MeleeAttackMob", "SW.Mob.Type1");
    expect(traitClosure(zombie, byKey)).toEqual([
      "SW.Property.Spawnable",
      "SW.Mob.Default.MeleeAttackMob",
      "SW.Mob.Type1",
      "SW.Mob.Default.Hostile",
      "SW.Mob.Default.Base",
    ]);
  });

  it("survives a trait cycle", () => {
    const a = row("SW.A", "SW.B");
    const b = row("SW.B", "SW.A");
    const byKey = new Map([a, b].map((r) => [tagKey(r.TypeTag.TagName), r]));
    expect(traitClosure(a, byKey)).toEqual(["SW.B", "SW.A"]);
  });
});
