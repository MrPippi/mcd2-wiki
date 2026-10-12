import { describe, expect, it } from "vitest";
import { LANGS } from "../../../scripts/extract/config";
import type { ArmorSet, Entry } from "../../../scripts/extract/schemas";
import { buildPayload, effectOptions, enchantOptions, inPool, payloadJson, poolOptions, slotLabel, wholeSets } from "../../../src/lib/build/payload";
import { parseBuildPayload } from "../../../src/lib/build/parse";
import { BUILD_SLOTS, POOL_KEYS } from "../../../src/lib/build/slots";
import { publishedEntries } from "../../../src/lib/data";

const names = (en: string) => Object.fromEntries(LANGS.map((lang) => [lang, lang === "zh" ? `${en}（中）` : en])) as Entry["name"];
const entry = (slug: string, category: Entry["category"], extra: Partial<Entry> = {}): Entry =>
  ({ id: slug, slug, category, variant: "normal", release: "base", name: names(slug), description: names(""), links: {}, icon: `icons/${category}/${slug}.png`, ...extra }) as Entry;

const ENTRIES: Entry[] = [
  entry("sword", "melee"),
  entry("sword-unique1", "melee", { variant: "unique" }),
  entry("bow", "ranged"),
  entry("hunter-helmet", "armor", { armorPiece: "helmet" }),
  entry("hunter-chest", "armor", { armorPiece: "chest" }),
  entry("hunter-leggings", "armor", { armorPiece: "leggings" }),
  entry("hunter-boots", "armor", { armorPiece: "boots" }),
  entry("beacon", "artifact", { icon: undefined }),
  entry("red-cape", "cape"),
];
const NO_GEAR = { weapons: {}, artifacts: {}, armor: {} };
const set = (slug: string, pieces: ArmorSet["pieces"]): ArmorSet => ({ id: slug, slug, variant: "normal", name: names(slug), pieces }) as ArmorSet;

describe("inPool", () => {
  it("splits armor by piece", () => {
    expect(inPool(ENTRIES[3], "helmet")).toBe(true);
    expect(inPool(ENTRIES[3], "chest")).toBe(false);
    expect(inPool(ENTRIES[0], "melee")).toBe(true);
    expect(inPool(ENTRIES[0], "ranged")).toBe(false);
  });
});

describe("poolOptions", () => {
  it("names, links and marks each option in the page language", () => {
    expect(poolOptions("melee", "zh", ENTRIES, NO_GEAR)).toEqual([
      { slug: "sword", name: "sword（中）", search: expect.stringContaining("sword"), icon: "/icons/melee/sword.png", href: "/zh/melee/sword/" },
      { slug: "sword-unique1", name: "sword-unique1（中）", search: expect.any(String), icon: "/icons/melee/sword-unique1.png", href: "/zh/melee/sword-unique1/", unique: true },
    ]);
  });

  it("links armor to its piece page and leaves out a missing icon", () => {
    expect(poolOptions("helmet", "en", ENTRIES)[0].href).toBe("/en/armor/piece/hunter-helmet/");
    expect(poolOptions("artifact", "en", ENTRIES)).toEqual([{ slug: "beacon", name: "beacon", search: "beacon beacon（中）", href: "/en/artifact/beacon/" }]);
  });

  it("offers no cosmetics", () => {
    for (const pool of POOL_KEYS) expect(poolOptions(pool, "en", ENTRIES).map((option) => option.slug), pool).not.toContain("red-cape");
  });
});

describe("wholeSets", () => {
  it("offers only sets with all four pieces pickable", () => {
    const full = set("hunter", { helmet: "hunter-helmet", chest: "hunter-chest", leggings: "hunter-leggings", boots: "hunter-boots" });
    const partial = set("broken", { helmet: "hunter-helmet", chest: "gone", leggings: "hunter-leggings", boots: "hunter-boots" });
    const swapped = set("swapped", { helmet: "hunter-chest", chest: "hunter-helmet", leggings: "hunter-leggings", boots: "hunter-boots" });
    expect(wholeSets("en", [full, partial, swapped], ENTRIES)).toEqual([
      { slug: "hunter", name: "hunter", search: "hunter hunter（中）", pieces: full.pieces },
    ]);
  });
});

describe("slotLabel", () => {
  it("numbers artifacts and talismans only", () => {
    const label = (key: string) => slotLabel(BUILD_SLOTS.find((slot) => slot.key === key)!, "en");
    expect(label("artifact3")).toMatch(/ 3$/);
    expect(label("talisman1")).toMatch(/ 1$/);
    expect(label("melee")).not.toMatch(/\d/);
    expect(label("boots")).not.toMatch(/\d/);
    expect(label("artifact1")).toBe("Artifact 1");
    expect(label("talisman2")).toBe("Talisman 2");
  });
});

describe("buildPayload", () => {
  it("passes its own check in every language", () => {
    for (const lang of LANGS) expect(parseBuildPayload(JSON.parse(payloadJson(buildPayload(lang)))), lang).toBeDefined();
  });

  it("offers every pool something from the released items only", () => {
    const payload = buildPayload("en");
    const released = new Set(publishedEntries.map((e) => `${e.category}/${e.slug}`));
    for (const pool of POOL_KEYS) expect(payload.pools[pool].length, pool).toBeGreaterThan(0);
    for (const option of payload.pools.melee) expect(released.has(`melee/${option.slug}`)).toBe(true);
    expect(payload.sets.length).toBeGreaterThan(0);
  });

  it("stays small enough to inline", () => {
    // Items, enchantments and the effect list (each item points into it by index); about 90 KB raw, far less gzipped.
    for (const lang of LANGS) expect(payloadJson(buildPayload(lang)).length, lang).toBeLessThan(120_000);
  });

  it("escapes < so the JSON cannot close its script tag", () => {
    const json = payloadJson({ ...buildPayload("en"), sets: [{ slug: "x", name: "</script>", search: "", pieces: { helmet: "a", chest: "b", leggings: "c", boots: "d" } }] });
    expect(json).not.toContain("<");
    expect(JSON.parse(json).sets[0].name).toBe("</script>");
  });
});

describe("parseBuildPayload", () => {
  const good = () => JSON.parse(payloadJson(buildPayload("en")));

  it.each([
    ["not an object", () => 3],
    ["no pools", () => ({ ...good(), pools: undefined })],
    ["a missing pool", () => ({ ...good(), pools: { ...good().pools, talisman: undefined } })],
    ["an option without a name", () => ({ ...good(), pools: { ...good().pools, talisman: [{ slug: "pig", search: "", href: "/x/" }] } })],
    ["an option with a bad flag", () => ({ ...good(), pools: { ...good().pools, talisman: [{ slug: "pig", name: "Pig", search: "", href: "/x/", unique: false }] } })],
    ["a set missing a piece", () => ({ ...good(), sets: [{ slug: "s", name: "S", search: "", pieces: { helmet: "a" } }] })],
    ["a missing slot label", () => ({ ...good(), labels: { ...good().labels, slots: {} } })],
    ["a dropped label without {n}", () => ({ ...good(), labels: { ...good().labels, dropped: "gone" } })],
    ["no game version", () => ({ ...good(), gameVersion: "" })],
    ["no enchantment list", () => ({ ...good(), enchantments: undefined })],
    ["an enchantment with no slot", () => ({ ...good(), enchantments: [{ slug: "x", name: "X", search: "", href: "/x/", slots: [] }] })],
    ["an enchantment with an unknown slot", () => ({ ...good(), enchantments: [{ slug: "x", name: "X", search: "", href: "/x/", slots: ["cape"] }] })],
    ["a built-in label without {name}", () => ({ ...good(), labels: { ...good().labels, builtIn: "Built in" } })],
    ["a fixed bonus without a link", () => ({ ...good(), pools: { ...good().pools, melee: [{ slug: "s", name: "S", search: "", href: "/s/", fixed: { name: "F" } }] } })],
    ["a version label without {version}", () => ({ ...good(), labels: { ...good().labels, gameVersion: "Version" } })],
    ["an old-version label without {current}", () => ({ ...good(), labels: { ...good().labels, oldVersion: "Made for {old}" } })],
  ])("rejects %s", (_name, make) => {
    expect(parseBuildPayload(make())).toBeUndefined();
  });
});

describe("enchantOptions", () => {
  const enchantments = [
    entry("fire-aspect", "enchantment"),
    entry("multi-roll", "enchantment"),
    entry("mauler-dive", "enchantment"),
    entry("swirling-unique", "enchantment", { variant: "unique" }),
  ];
  const data = {
    "fire-aspect": { tiers: [["1"]], slots: ["melee" as const] },
    "multi-roll": { tiers: [["1"]], slots: ["helmet" as const, "chest" as const, "leggings" as const, "boots" as const] },
    "mauler-dive": { tiers: [["1"]] },
    "swirling-unique": { tiers: [["1"]], slots: ["melee" as const] },
  };

  it("offers released, non-unique enchantments that name a slot, with those slots", () => {
    expect(enchantOptions("en", enchantments, data)).toEqual([
      { slug: "fire-aspect", name: "fire-aspect", search: expect.any(String), icon: "/icons/enchantment/fire-aspect.png", href: "/en/enchantment/fire-aspect/", slots: ["melee"] },
      { slug: "multi-roll", name: "multi-roll", search: expect.any(String), icon: "/icons/enchantment/multi-roll.png", href: "/en/enchantment/multi-roll/", slots: ["helmet", "chest", "leggings", "boots"] },
    ]);
  });

  it("covers every enchantable slot with the real data", () => {
    const options = enchantOptions("en");
    for (const slot of ["melee", "ranged", "helmet", "chest", "leggings", "boots"] as const) {
      expect(options.filter((option) => option.slots.includes(slot)).length, slot).toBeGreaterThan(0);
    }
  });
});

describe("fixed bonuses", () => {
  it("names the bonus a unique weapon always carries", () => {
    const weapons = { "sword-unique1": { fixed: { kind: "effect", slug: "fire-focus", value: 1 } } } as never;
    const option = poolOptions("melee", "en", ENTRIES, { ...NO_GEAR, weapons }).find((found) => found.slug === "sword-unique1");
    expect(option?.fixed?.href).toBe("/en/effect/#fire-focus");
    expect(option?.fixed?.effect).toBe(true);
  });

  it("leaves it out when the bonus has no released entry", () => {
    const weapons = { "sword-unique1": { fixed: { kind: "effect", slug: "not-a-real-effect", value: 1 } } } as never;
    expect(poolOptions("melee", "en", ENTRIES, { ...NO_GEAR, weapons }).find((found) => found.slug === "sword-unique1")).not.toHaveProperty("fixed");
  });
});

describe("effects", () => {
  const index = new Map([["protection", 0], ["looting", 1]]);
  const gear = {
    ...NO_GEAR,
    armor: {
      "hunter-helmet": { compatible: [{ effect: "looting", tiers: [1, 2, 3] as [number, number, number] }, { effect: "gone", tiers: [1, 2, 3] as [number, number, number] }], fixed: { effect: "fire-focus", value: 1 } },
    },
  };

  it("points each item at the effects it can roll, skipping ones the list lacks", () => {
    expect(poolOptions("helmet", "en", ENTRIES, gear, index)[0]?.effects).toEqual([1]);
    expect(poolOptions("melee", "en", ENTRIES, gear, index)[0]).not.toHaveProperty("effects");
  });

  it("never offers an item its own built-in effect again", () => {
    const own = { ...gear, armor: { "hunter-helmet": { compatible: [{ effect: "looting", tiers: [1, 2, 3] as [number, number, number] }], fixed: { effect: "looting", value: 1 } } } };
    expect(poolOptions("helmet", "en", ENTRIES, own, index)[0]).not.toHaveProperty("effects");
  });

  it("names a unique armor piece's built-in effect", () => {
    expect(poolOptions("helmet", "en", ENTRIES, gear, index)[0]?.fixed?.href).toBe("/en/effect/#fire-focus");
  });

  it("lists released effects only", () => {
    expect(effectOptions("en", [entry("protection", "effect"), entry("sword", "melee")]).map((option) => option.slug)).toEqual(["protection"]);
  });

  it("gives the real payload effects for weapons, armor and artifacts but not talismans", () => {
    const payload = buildPayload("en");
    for (const pool of ["melee", "ranged", "helmet", "boots", "artifact"] as const) {
      expect(payload.pools[pool].some((option) => (option.effects ?? []).length > 0), pool).toBe(true);
    }
    expect(payload.pools.talisman.some((option) => option.effects)).toBe(false);
  });

  it("rejects an item pointing past the effect list", () => {
    const good = JSON.parse(payloadJson(buildPayload("en")));
    const bad = { ...good, pools: { ...good.pools, melee: [{ ...good.pools.melee[0], effects: [good.effects.length] }] } };
    expect(parseBuildPayload(bad)).toBeUndefined();
  });
});
