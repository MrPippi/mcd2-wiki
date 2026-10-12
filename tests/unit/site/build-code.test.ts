import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runtimeImports } from "../../helpers/imports";
import { BUILD_VERSION, buildSearch, decodeBuild, encodeBuild, type EnchantPools, type Pools } from "../../../src/lib/build/code";
import { BUILD_SLOTS, ENCHANT_SLOT_KEYS, POOL_KEYS, slotsIn } from "../../../src/lib/build/slots";

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
};

describe("BUILD_SLOTS", () => {
  it("lists the twelve equipment slots in display order", () => {
    expect(BUILD_SLOTS.map((slot) => slot.key)).toEqual([
      "melee", "ranged", "helmet", "chest", "leggings", "boots",
      "artifact1", "artifact2", "artifact3", "talisman1", "talisman2", "talisman3",
    ]);
  });

  it("gives every pool at least one slot and every slot a known pool", () => {
    expect(new Set(BUILD_SLOTS.map((slot) => slot.pool))).toEqual(new Set(POOL_KEYS));
  });

  it("groups the slots", () => {
    expect(slotsIn("armor").map((slot) => slot.key)).toEqual(["helmet", "chest", "leggings", "boots"]);
    expect(slotsIn("artifacts")).toHaveLength(3);
    expect(slotsIn("talismans")).toHaveLength(3);
  });
});

describe("encodeBuild", () => {
  it("is empty for an empty build", () => {
    expect(encodeBuild({})).toBe("");
  });

  it("writes the version and only the filled slots", () => {
    expect(encodeBuild({ melee: "sword", boots: "hunter-boots" })).toBe(`v=${BUILD_VERSION}&m=sword&b=hunter-boots`);
  });

  it("keeps the position of empty artifact slots and drops trailing empties", () => {
    expect(encodeBuild({ artifact1: "horn", artifact3: "wind" })).toBe("v=1&a=horn,,wind");
    expect(encodeBuild({ talisman2: "ammo" })).toBe("v=1&t=,ammo");
  });

  it("escapes characters a slug should never have", () => {
    expect(encodeBuild({ melee: "a&b=c" })).toBe("v=1&m=a%26b%3Dc");
  });
});

describe("decodeBuild", () => {
  it("round-trips a full build", () => {
    const build = {
      melee: "sword", ranged: "bow", helmet: "hunter-helmet", chest: "hunter-chest", leggings: "hunter-leggings", boots: "hunter-boots",
      artifact1: "horn", artifact2: "totem", artifact3: "wind", talisman1: "golem", talisman2: "ammo", talisman3: "wolf",
    };
    expect(decodeBuild(`?${encodeBuild(build)}`, POOLS)).toEqual({ build, dropped: 0, unsupported: false, enchants: {} });
  });

  it("reads an empty query as an empty build", () => {
    expect(decodeBuild("", POOLS)).toEqual({ build: {}, dropped: 0, unsupported: false, enchants: {} });
    expect(decodeBuild("?", POOLS)).toEqual({ build: {}, dropped: 0, unsupported: false, enchants: {} });
  });

  it("ignores unrelated parameters", () => {
    expect(decodeBuild("?utm_source=x", POOLS)).toEqual({ build: {}, dropped: 0, unsupported: false, enchants: {} });
  });

  it("refuses another version or a build without one", () => {
    expect(decodeBuild("?v=2&m=sword", POOLS)).toEqual({ build: {}, dropped: 0, unsupported: true, enchants: {} });
    expect(decodeBuild("?m=sword", POOLS)).toEqual({ build: {}, dropped: 0, unsupported: true, enchants: {} });
  });

  it("drops slugs the slot does not offer", () => {
    expect(decodeBuild("?v=1&m=bow&r=bow&h=dragon", POOLS)).toEqual({ build: { ranged: "bow" }, dropped: 2, unsupported: false, enchants: {} });
  });

  it("keeps positions and drops repeats and extras in list slots", () => {
    expect(decodeBuild("?v=1&a=horn,,horn,wind&t=golem,golem", POOLS)).toEqual({
      build: { artifact1: "horn", talisman1: "golem" },
      dropped: 3,
      unsupported: false,
      enchants: {},
    });
  });
});

describe("buildSearch", () => {
  it("keeps unrelated parameters and replaces the old build", () => {
    expect(buildSearch("?utm_source=x&v=1&m=axe&a=horn", { ranged: "bow" })).toBe("?utm_source=x&v=1&r=bow");
  });

  it("is empty when nothing is left", () => {
    expect(buildSearch("?v=1&m=axe", {})).toBe("");
  });

  it("keeps only the unrelated parameters for an empty build", () => {
    expect(buildSearch("?v=9&m=axe&ref=discord", {})).toBe("?ref=discord");
  });
});

describe("game version", () => {
  it("writes the game version after the format version", () => {
    expect(encodeBuild({ melee: "sword" }, { gameVersion: "1.1.2.0" })).toBe("v=1&gv=1.1.2.0&m=sword");
  });

  it("leaves it out of an empty build", () => {
    expect(encodeBuild({}, { gameVersion: "1.1.2.0" })).toBe("");
    expect(buildSearch("?ref=x", {}, { gameVersion: "1.1.2.0" })).toBe("?ref=x");
  });

  it("reads it back with the build", () => {
    expect(decodeBuild("?v=1&gv=1.1.2.0&m=sword", POOLS)).toEqual({ build: { melee: "sword" }, dropped: 0, unsupported: false, enchants: {}, gameVersion: "1.1.2.0" });
  });

  it("ignores a version that is not a plain version string", () => {
    for (const bad of ["", "1.1<script>", "x".repeat(40), "1 2"]) {
      expect(decodeBuild(`?v=1&gv=${encodeURIComponent(bad)}&m=sword`, POOLS).gameVersion, bad).toBeUndefined();
    }
  });

  it("replaces an old game version in the address", () => {
    expect(buildSearch("?v=1&gv=1.0.0.0&m=axe", { ranged: "bow" }, { gameVersion: "1.1.2.0" })).toBe("?v=1&gv=1.1.2.0&r=bow");
  });
});

describe("enchantments", () => {
  const ENCHANT_POOLS: EnchantPools = {
    melee: pool("fire-aspect", "sharp"),
    ranged: pool("ricochet"),
    helmet: pool("multi-roll"),
    chest: pool("multi-roll", "multi-potion"),
    leggings: pool("multi-roll"),
    boots: pool("multi-roll"),
  };
  const decode = (search: string) => decodeBuild(search, POOLS, ENCHANT_POOLS);

  it("lists the six enchantable slots in address order", () => {
    expect(ENCHANT_SLOT_KEYS).toEqual(["melee", "ranged", "helmet", "chest", "leggings", "boots"]);
  });

  it("writes slug:tier per slot after the items, keeping positions", () => {
    const enchants = { melee: { slug: "fire-aspect", tier: 3 }, chest: { slug: "multi-roll", tier: 1 } } as const;
    expect(encodeBuild({ melee: "sword", chest: "hunter-chest" }, { enchants })).toBe("v=1&m=sword&c=hunter-chest&e=fire-aspect:3,,,multi-roll:1");
  });

  it("round-trips the enchantments", () => {
    const build = { melee: "sword", ranged: "bow", boots: "hunter-boots" };
    const enchants = { melee: { slug: "sharp", tier: 2 }, ranged: { slug: "ricochet", tier: 1 }, boots: { slug: "multi-roll", tier: 3 } } as const;
    expect(decode(`?${encodeBuild(build, { enchants })}`)).toEqual({ build, enchants, dropped: 0, unsupported: false });
  });

  it("drops an enchantment the slot cannot take, a bad tier, or one on an empty slot", () => {
    expect(decode("?v=1&m=sword&r=bow&h=hunter-helmet&e=ricochet:1,ricochet:4,multi-roll:2,multi-roll:1")).toEqual({
      build: { melee: "sword", ranged: "bow", helmet: "hunter-helmet" },
      enchants: { helmet: { slug: "multi-roll", tier: 2 } },
      dropped: 3,
      unsupported: false,
    });
    expect(decode("?v=1&m=sword&e=fire-aspect,sharp:x,,,,,,fire-aspect:1").dropped).toBe(3);
  });

  it("drops enchantments when the item slots were unreadable", () => {
    expect(decode("?v=1&m=dragon&e=fire-aspect:1")).toEqual({ build: {}, enchants: {}, dropped: 2, unsupported: false });
  });

  it("leaves out an enchantment whose slot is empty", () => {
    expect(encodeBuild({ melee: "sword" }, { enchants: { melee: { slug: "sharp", tier: 1 }, ranged: { slug: "ricochet", tier: 2 } } })).toBe("v=1&m=sword&e=sharp:1");
  });

  it("drops an enchantment with more than one level part", () => {
    expect(decode("?v=1&m=sword&e=sharp:1:2")).toMatchObject({ enchants: {}, dropped: 1 });
  });

  it("removes the enchantments from the address with the build", () => {
    expect(buildSearch("?ref=x&v=1&m=sword&e=sharp:1", {})).toBe("?ref=x");
  });
});

describe("module boundaries", () => {
  it("loads nothing but the slot table at run time", () => {
    const dir = path.resolve(__dirname, "../../../src/lib/build");
    expect(runtimeImports(readFileSync(path.join(dir, "slots.ts"), "utf8"))).toEqual([]);
    expect(runtimeImports(readFileSync(path.join(dir, "code.ts"), "utf8"))).toEqual(["./slots"]);
  });
});
