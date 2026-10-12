import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runtimeImports } from "../../helpers/imports";
import { BUILD_VERSION, decodeBuild, encodeBuild, type Pools } from "../../../src/lib/build/code";
import { BUILD_SLOTS, POOL_KEYS, slotsIn } from "../../../src/lib/build/slots";

const pool = (...slugs: string[]): ReadonlySet<string> => new Set(slugs);
const POOLS: Pools = {
  melee: pool("sword", "axe"),
  ranged: pool("bow"),
  helmet: pool("hunter-helmet"),
  chest: pool("hunter-chest"),
  leggings: pool("hunter-leggings"),
  boots: pool("hunter-boots"),
  artifact: pool("horn", "totem", "wind", "flask", "net"),
  talisman: pool("golem", "ammo", "wolf", "speed"),
  cape: pool("red-cape"),
  pet: pool("pig"),
};

describe("BUILD_SLOTS", () => {
  it("lists the fifteen equipment slots in display order", () => {
    expect(BUILD_SLOTS.map((slot) => slot.key)).toEqual([
      "melee", "ranged", "helmet", "chest", "leggings", "boots",
      "artifact1", "artifact2", "artifact3", "artifact4", "talisman1", "talisman2", "talisman3", "cape", "pet",
    ]);
  });

  it("gives every pool at least one slot and every slot a known pool", () => {
    expect(new Set(BUILD_SLOTS.map((slot) => slot.pool))).toEqual(new Set(POOL_KEYS));
  });

  it("groups the slots", () => {
    expect(slotsIn("armor").map((slot) => slot.key)).toEqual(["helmet", "chest", "leggings", "boots"]);
    expect(slotsIn("artifacts")).toHaveLength(4);
    expect(slotsIn("talismans")).toHaveLength(3);
  });
});

describe("encodeBuild", () => {
  it("is empty for an empty build", () => {
    expect(encodeBuild({})).toBe("");
  });

  it("writes the version and only the filled slots", () => {
    expect(encodeBuild({ melee: "sword", pet: "pig" })).toBe(`v=${BUILD_VERSION}&m=sword&pet=pig`);
  });

  it("keeps the position of empty artifact slots and drops trailing empties", () => {
    expect(encodeBuild({ artifact1: "horn", artifact3: "wind" })).toBe("v=1&a=horn%2C%2Cwind");
    expect(encodeBuild({ talisman2: "ammo" })).toBe("v=1&t=%2Cammo");
  });
});

describe("decodeBuild", () => {
  it("round-trips a full build", () => {
    const build = {
      melee: "sword", ranged: "bow", helmet: "hunter-helmet", chest: "hunter-chest", leggings: "hunter-leggings", boots: "hunter-boots",
      artifact1: "horn", artifact2: "totem", artifact3: "wind", artifact4: "flask", talisman1: "golem", talisman2: "ammo", talisman3: "wolf",
      cape: "red-cape", pet: "pig",
    };
    expect(decodeBuild(`?${encodeBuild(build)}`, POOLS)).toEqual({ build, dropped: 0, unsupported: false });
  });

  it("reads an empty query as an empty build", () => {
    expect(decodeBuild("", POOLS)).toEqual({ build: {}, dropped: 0, unsupported: false });
    expect(decodeBuild("?", POOLS)).toEqual({ build: {}, dropped: 0, unsupported: false });
  });

  it("ignores unrelated parameters", () => {
    expect(decodeBuild("?utm_source=x", POOLS)).toEqual({ build: {}, dropped: 0, unsupported: false });
  });

  it("refuses another version or a build without one", () => {
    expect(decodeBuild("?v=2&m=sword", POOLS)).toEqual({ build: {}, dropped: 0, unsupported: true });
    expect(decodeBuild("?m=sword", POOLS)).toEqual({ build: {}, dropped: 0, unsupported: true });
  });

  it("drops slugs the slot does not offer", () => {
    expect(decodeBuild("?v=1&m=bow&r=bow&pet=dragon", POOLS)).toEqual({ build: { ranged: "bow" }, dropped: 2, unsupported: false });
  });

  it("keeps positions and drops repeats and extras in list slots", () => {
    expect(decodeBuild("?v=1&a=horn,,horn,wind,net&t=golem,golem", POOLS)).toEqual({
      build: { artifact1: "horn", artifact4: "wind", talisman1: "golem" },
      dropped: 3,
      unsupported: false,
    });
  });
});

describe("module boundaries", () => {
  it("loads nothing but the slot table at run time", () => {
    const dir = path.resolve(__dirname, "../../../src/lib/build");
    expect(runtimeImports(readFileSync(path.join(dir, "slots.ts"), "utf8"))).toEqual([]);
    expect(runtimeImports(readFileSync(path.join(dir, "code.ts"), "utf8"))).toEqual(["./slots"]);
  });
});
