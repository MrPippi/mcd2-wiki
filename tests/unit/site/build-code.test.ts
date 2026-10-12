import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runtimeImports } from "../../helpers/imports";
import { BUILD_VERSION, buildSearch, decodeBuild, effectCap, encodeBuild, MAX_EFFECTS, type EffectRules, type EnchantPools, type Pools } from "../../../src/lib/build/code";
import { BUILD_SLOTS, EFFECT_SLOT_KEYS, ENCHANT_SLOT_KEYS, POOL_KEYS, slotsIn } from "../../../src/lib/build/slots";

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
    expect(decodeBuild(`?${encodeBuild(build)}`, POOLS)).toEqual({ build, dropped: 0, unsupported: false, enchants: {}, effects: {} });
  });

  it("reads an empty query as an empty build", () => {
    expect(decodeBuild("", POOLS)).toEqual({ build: {}, dropped: 0, unsupported: false, enchants: {}, effects: {} });
    expect(decodeBuild("?", POOLS)).toEqual({ build: {}, dropped: 0, unsupported: false, enchants: {}, effects: {} });
  });

  it("ignores unrelated parameters", () => {
    expect(decodeBuild("?utm_source=x", POOLS)).toEqual({ build: {}, dropped: 0, unsupported: false, enchants: {}, effects: {} });
  });

  it("refuses another version or a build without one", () => {
    expect(decodeBuild("?v=2&m=sword", POOLS)).toEqual({ build: {}, dropped: 0, unsupported: true, enchants: {}, effects: {} });
    expect(decodeBuild("?m=sword", POOLS)).toEqual({ build: {}, dropped: 0, unsupported: true, enchants: {}, effects: {} });
  });

  it("drops slugs the slot does not offer", () => {
    expect(decodeBuild("?v=1&m=bow&r=bow&h=dragon", POOLS)).toEqual({ build: { ranged: "bow" }, dropped: 2, unsupported: false, enchants: {}, effects: {} });
  });

  it("keeps positions and drops repeats and extras in list slots", () => {
    expect(decodeBuild("?v=1&a=horn,,horn,wind&t=golem,golem", POOLS)).toEqual({
      build: { artifact1: "horn", talisman1: "golem" },
      dropped: 3,
      unsupported: false,
      enchants: {},
      effects: {},
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
    expect(decodeBuild("?v=1&gv=1.1.2.0&m=sword", POOLS)).toEqual({ build: { melee: "sword" }, dropped: 0, unsupported: false, enchants: {}, effects: {}, gameVersion: "1.1.2.0" });
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
    expect(decode(`?${encodeBuild(build, { enchants })}`)).toEqual({ build, enchants, effects: {}, dropped: 0, unsupported: false });
  });

  it("drops an enchantment the slot cannot take, a bad tier, or one on an empty slot", () => {
    expect(decode("?v=1&m=sword&r=bow&h=hunter-helmet&e=ricochet:1,ricochet:4,multi-roll:2,multi-roll:1")).toEqual({
      build: { melee: "sword", ranged: "bow", helmet: "hunter-helmet" },
      enchants: { helmet: { slug: "multi-roll", tier: 2 } },
      effects: {},
      dropped: 3,
      unsupported: false,
    });
    expect(decode("?v=1&m=sword&e=fire-aspect,sharp:x,,,,,,fire-aspect:1").dropped).toBe(3);
  });

  it("drops enchantments when the item slots were unreadable", () => {
    expect(decode("?v=1&m=dragon&e=fire-aspect:1")).toEqual({ build: {}, enchants: {}, effects: {}, dropped: 2, unsupported: false });
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

describe("effects", () => {
  const ALLOWED: Record<string, readonly string[]> = { "sword-unique": ["sharpness", "looting"], sword: ["sharpness", "looting", "critical-edge", "swiftness"], bow: ["power"], horn: ["cooldown"], "hunter-helmet": ["protection"] };
  const RULES: EffectRules = { allowed: (_slot, item) => new Set(ALLOWED[item] ?? []), builtIn: (_slot, item) => item === "sword-unique" };
  const POOLS_U: Pools = { ...POOLS, melee: pool("sword", "axe", "sword-unique") };
  const decode = (search: string) => decodeBuild(search, POOLS_U, undefined, RULES);

  it("lists the nine slots that take effects in address order", () => {
    expect(EFFECT_SLOT_KEYS).toEqual(["melee", "ranged", "helmet", "chest", "leggings", "boots", "artifact1", "artifact2", "artifact3"]);
  });

  it("writes slug:tier joined by ~ per slot after the enchantments", () => {
    const effects = { melee: [{ slug: "sharpness", tier: 3 }, { slug: "looting", tier: 1 }], artifact1: [{ slug: "cooldown", tier: 2 }] } as const;
    expect(encodeBuild({ melee: "sword", artifact1: "horn" }, { effects })).toBe("v=1&m=sword&a=horn&x=sharpness:3~looting:1,,,,,,cooldown:2");
  });

  it("round-trips the effects", () => {
    const build = { melee: "sword", ranged: "bow", helmet: "hunter-helmet" };
    const effects = { melee: [{ slug: "looting", tier: 2 }], ranged: [{ slug: "power", tier: 3 }], helmet: [{ slug: "protection", tier: 1 }] } as const;
    expect(decode(`?${encodeBuild(build, { effects })}`)).toEqual({ build, enchants: {}, effects, dropped: 0, unsupported: false });
  });

  it("drops effects the item cannot roll, repeats, bad tiers and effects on empty slots", () => {
    expect(decode("?v=1&m=sword&x=sharpness:1~sharpness:2~power:1~looting:4,power:1")).toEqual({
      build: { melee: "sword" },
      enchants: {},
      effects: { melee: [{ slug: "sharpness", tier: 1 }] },
      dropped: 4,
      unsupported: false,
    });
  });

  it("counts a built-in effect toward the cap", () => {
    expect(effectCap(false)).toBe(2);
    expect(effectCap(true)).toBe(1);
    expect(decode("?v=1&m=sword-unique&x=sharpness:1~looting:1")).toMatchObject({ effects: { melee: [{ slug: "sharpness", tier: 1 }] }, dropped: 1 });
  });

  it("keeps at most two effects on an item", () => {
    const four = "sharpness:1~looting:1~critical-edge:1~swiftness:1";
    expect(MAX_EFFECTS).toBe(2);
    expect(decode(`?v=1&m=sword&x=${four}`).effects.melee).toEqual([{ slug: "sharpness", tier: 1 }, { slug: "looting", tier: 1 }]);
    expect(decode(`?v=1&m=sword&x=${four}`).dropped).toBe(2);
  });
});

describe("module boundaries", () => {
  it("loads nothing but the slot table at run time", () => {
    const dir = path.resolve(__dirname, "../../../src/lib/build");
    expect(runtimeImports(readFileSync(path.join(dir, "slots.ts"), "utf8"))).toEqual([]);
    expect(runtimeImports(readFileSync(path.join(dir, "code.ts"), "utf8"))).toEqual(["./slots"]);
  });
});
