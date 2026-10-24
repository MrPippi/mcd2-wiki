import { describe, expect, it } from "vitest";
import { GameChangesSchema } from "../../../shared/game-changes-schema";
import { localizedFrom } from "../../../shared/lang";
import { diffRecord, diffVersions, flatten, withVersion, type DataSnapshot } from "../../../scripts/game-diff/diff";

const name = (en: string) => localizedFrom((lang) => (lang === "zh" ? `中${en}` : en));

const snapshot = (damage: number, extra: Record<string, unknown> = {}): DataSnapshot => ({
  entries: [
    { slug: "axe", category: "melee", variant: "normal", release: "base", name: name("Axe"), icon: "icons/axe.png" },
    { slug: "bow", category: "ranged", variant: "normal", release: "base", name: name("Bow") },
  ],
  weapons: {
    weapons: {
      axe: { weight: "Heavy", melee: { swings: [{ damage, reach: 2.5 }] }, compatible: [{ effect: "looting", tiers: [0.2, 0.4] }, { effect: "sharpness", tiers: [0.1, 0.2] }] },
      ...extra,
    },
  },
  mobs: { mobs: [{ slug: "zombie", name: name("Zombie"), portrait: "mobs/zombie.webp", stats: [{ key: "health", value: 100 }] }] },
});

describe("flatten", () => {
  it("keys list items by their id field and keeps lists of plain values whole", () => {
    expect([...flatten({ compatible: [{ effect: "looting", tiers: [0.2, 0.4] }], swings: [{ damage: 1 }, { damage: 2 }] })]).toEqual([
      ["compatible[effect=looting].tiers", "0.2 / 0.4"],
      ["swings[0].damage", "1"],
      ["swings[1].damage", "2"],
    ]);
  });

  it("leaves out text and art", () => {
    expect([...flatten({ name: name("Axe"), icon: "a.png", note: name("x"), weight: "Heavy" })]).toEqual([["weight", "Heavy"]]);
  });
});

describe("diffRecord", () => {
  it("reports changed, added and removed fields but not a reordered list", () => {
    const before = { a: 1, b: 2, list: [{ key: "x", v: 1 }, { key: "y", v: 2 }] };
    const after = { a: 1, c: 3, list: [{ key: "y", v: 2 }, { key: "x", v: 5 }] };
    expect(diffRecord(before, after)).toEqual([
      { path: "b", before: "2" },
      { path: "list[key=x].v", before: "1", after: "5" },
      { path: "c", after: "3" },
    ]);
  });
});

describe("diffVersions", () => {
  it("names and links changed records and leaves unchanged sources out", () => {
    const result = diffVersions("1.0", "1.1", snapshot(40), snapshot(44));
    expect(result.from).toBe("1.0");
    expect(result.groups).toEqual([
      {
        source: "weapons",
        entities: [{ slug: "axe", name: name("Axe"), link: "melee/axe", status: "changed", fields: [{ path: "melee.swings[0].damage", before: "40", after: "44" }] }],
      },
    ]);
    expect(GameChangesSchema.parse([result])).toHaveLength(1);
  });

  it("lists added and removed records, without a link for the removed one", () => {
    const before = snapshot(40);
    const after = snapshot(40, { bow: { weight: "Light" } });
    expect(diffVersions("1.0", "1.1", before, after).groups[0]?.entities).toEqual([{ slug: "bow", name: name("Bow"), link: "ranged/bow", status: "added", fields: [] }]);
    expect(diffVersions("1.1", "1.2", after, before).groups[0]?.entities).toEqual([{ slug: "bow", name: name("Bow"), status: "removed", fields: [] }]);
  });

  it("finds nothing between identical data", () => {
    expect(diffVersions("1.0", "1.1", snapshot(40), snapshot(40)).groups).toEqual([]);
  });
});

describe("withVersion", () => {
  it("puts a new comparison first and replaces one for the same version", () => {
    const one = { from: "1.0", to: "1.1", groups: [] };
    const two = { from: "1.1", to: "1.2", groups: [] };
    expect(withVersion([one], two)).toEqual([two, one]);
    expect(withVersion([two, one], { ...two, from: "1.0" })).toEqual([{ ...two, from: "1.0" }, one]);
  });
});
