import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadLootTables } from "../../../scripts/extract/loot-tables";
import { loadMobTables } from "../../../scripts/extract/mob-tables";
import { buildMobs } from "../../../scripts/extract/mobs";
import { loadLocales } from "../../../scripts/extract/parse-locale";
import { hasOwnPool, hasPoolTags, slotKeyOf, slotsOf } from "../../../scripts/extract/loot-slots";
import { attachDrops, resolveDrops, unusedMobRows } from "../../../scripts/extract/mob-drops";
import type { MobDraft } from "../../../scripts/extract/mobs";
import type { Mob } from "../../../scripts/extract/mob-schema";
import { loc } from "../../helpers/localized";
import { lootRow, lootTables, slot } from "../../helpers/mob-tables";

const rows = lootTables({
  mob: [
    lootRow("Boss", "SW.Trait.Boss", [slot("Item", 1, 6, 0.5, true), slot("SpringStone", 5, 5, 0.5, true, ["SW.Item.Currency.SpringStone"])]),
    lootRow("MiniBoss", "SW.Trait.MiniBoss", [slot("Item", 1, 4, 0.25, true), slot("SpringStone", 2, 3, 0.5, true, ["SW.Item.Currency.SpringStone"])]),
    lootRow("SoulStated", "SW.Mob.Default.SoulStated", [slot("Item", 0, 1, 0.25, true)]),
    lootRow("GlobalHostileMobLoot", "SW.Mob.Default.Hostile", [
      slot("Item", 0, 1, 0.0125, false),
      slot("Emeralds", 0, 5, 0.025, false, ["SW.Item.Currency.Emerald"]),
      slot("TNT", 0, 1, 0.0125, false, ["SW.Item.TNT"]),
    ]),
    lootRow("Maw", "SW.Mob.Maw", [slot("Item", 1, 3, 0.5, false)]),
    lootRow("Geomancer", "SW.Mob.Geomancer", [slot("Item", 0, 1, 0.1, false, ["SW.Item.Artifact.Fireworks"])]),
  ],
}).mob;

const HOSTILE = ["SW.Mob.Default.MeleeAttackMob", "SW.Mob.Default.Hostile", "SW.Mob.Default.Base"];
const item = (drops: ReturnType<typeof resolveDrops>) => drops?.find((drop) => drop.slot === "item");

describe("resolveDrops", () => {
  it("gives a regular mob the global hostile rolls: 1 roll at 1.25%, with no item list", () => {
    const drops = resolveDrops(["SW.Mob.Zombie"], ["SW.Mob.Type1", ...HOSTILE], rows);
    expect(item(drops)).toEqual({ slot: "item", guaranteed: 0, rolls: 1, chancePerRoll: 0.0125, pool: "none" });
    expect(drops?.find((drop) => drop.slot === "emeralds")).toEqual({ slot: "emeralds", guaranteed: 0, rolls: 5, chancePerRoll: 0.025, pool: "own" });
  });

  it("gives a boss 1 guaranteed plus 6 rolls at 50%, from the area pool; the boss row wins over the hostile row per slot", () => {
    const drops = resolveDrops(["SW.Mob.Monstrosity.Moss"], ["SW.Mob.Default.Type3", "SW.Trait.Boss", ...HOSTILE], rows);
    expect(item(drops)).toEqual({ slot: "item", guaranteed: 1, rolls: 6, chancePerRoll: 0.5, pool: "area" });
    expect(drops?.find((drop) => drop.slot === "springStone")).toEqual({ slot: "springStone", guaranteed: 5, rolls: 5, chancePerRoll: 0.5, pool: "own" });
    expect(drops?.find((drop) => drop.slot === "tnt")?.rolls).toBe(1);   // slots the boss row lacks still come from the hostile row
  });

  it("gives a mini-boss 1 guaranteed plus 4 rolls at 25%", () => {
    const drops = resolveDrops(["SW.Mob.Evoker"], ["SW.Mob.Default.Type2", "SW.Trait.MiniBoss", ...HOSTILE], rows);
    expect(item(drops)).toEqual({ slot: "item", guaranteed: 1, rolls: 4, chancePerRoll: 0.25, pool: "area" });
  });

  it("gives a Soul Corrupted mob 1 roll at 25% from the area pool", () => {
    const drops = resolveDrops(["SW.Mob.Zombie.SoulStated"], ["SW.Mob.Zombie", "SW.Mob.Default.SoulStated", ...HOSTILE], rows);
    expect(item(drops)).toEqual({ slot: "item", guaranteed: 0, rolls: 1, chancePerRoll: 0.25, pool: "area" });
  });

  it("lets a mob's own row beat the tier rows and keeps an explicit list as 'own'", () => {
    const drops = resolveDrops(["SW.Mob.Geomancer"], ["SW.Mob.Type1", ...HOSTILE], rows);
    expect(item(drops)).toEqual({ slot: "item", guaranteed: 0, rolls: 1, chancePerRoll: 0.1, pool: "own" });
  });

  it("describes only the counts for a boss whose row has no list and does not inherit one", () => {
    const drops = resolveDrops(["SW.Mob.Maw"], ["SW.Mob.Default.Type3", "SW.Trait.Boss", ...HOSTILE], rows);
    expect(item(drops)).toEqual({ slot: "item", guaranteed: 1, rolls: 3, chancePerRoll: 0.5, pool: "none" });
  });

  it("orders the tier rows Boss > MiniBoss > SoulStated > Hostile whatever order the closure lists them in", () => {
    const real = ["SW.Mob.Default.Type2", "SW.Mob.Default.MeleeAttackMob", "SW.Mob.Default.Hostile", "SW.Mob.Default.Base", "SW.Trait.MiniBoss"];
    expect(item(resolveDrops(["SW.Mob.Evoker"], real, rows))).toEqual({ slot: "item", guaranteed: 1, rolls: 4, chancePerRoll: 0.25, pool: "area" });
    const soul = ["SW.Mob.Default.SoulStated", "SW.Mob.Default.Hostile", "SW.Trait.MiniBoss"];
    expect(item(resolveDrops(["SW.Mob.Evoker.SoulStated"], soul, rows))?.rolls).toBe(4);
  });

  it("takes counts from the next row when a more specific slot is table-only, and keeps its list as 'own'", () => {
    const tableOnly = lootTables({ mob: [
      lootRow("Witch", "SW.Mob.Witch", [slot("Item", 0, 0, 0, false, ["SW.Item.Artifact.Fireworks"])]),
      lootRow("Plain", "SW.Mob.Plain", [slot("Item", 0, 0, 0, false)]),
      lootRow("Boss", "SW.Trait.Boss", [slot("Item", 1, 6, 0.5, true)]),
      lootRow("GlobalHostileMobLoot", "SW.Mob.Default.Hostile", [slot("Item", 0, 1, 0.0125, false)]),
    ] }).mob;
    expect(item(resolveDrops(["SW.Mob.Witch"], ["SW.Trait.Boss", ...HOSTILE], tableOnly))).toEqual({ slot: "item", guaranteed: 1, rolls: 6, chancePerRoll: 0.5, pool: "own" });
    expect(item(resolveDrops(["SW.Mob.Plain"], ["SW.Trait.Boss", ...HOSTILE], tableOnly))).toEqual({ slot: "item", guaranteed: 1, rolls: 6, chancePerRoll: 0.5, pool: "area" });
    expect(item(resolveDrops(["SW.Mob.Plain"], HOSTILE, tableOnly))?.rolls).toBe(1);
  });

  it("matches tags that differ only in case or the Sw. typo", () => {
    expect(item(resolveDrops(["Sw.Mob.Geomancer"], [], rows))?.pool).toBe("own");
  });

  it("drops nothing for a mob that cannot drop loot, and returns undefined when no row matches", () => {
    expect(resolveDrops(["SW.Mob.Shade_Clone"], ["SW.Trait.CannotDropLoot", ...HOSTILE], rows)).toEqual([]);
    expect(resolveDrops(["SW.Mob.Odd"], ["SW.Mob.Type1"], rows)).toBeUndefined();
  });

  it("leaves out slots that give nothing", () => {
    const empty = lootTables({ mob: [lootRow("GlobalHostileMobLoot", "SW.Mob.Default.Hostile", [slot("Item", 0, 0, 0, true)])] }).mob;
    expect(resolveDrops(["SW.Mob.Zombie"], HOSTILE, empty)).toEqual([]);
  });
});

// The real slot shapes: exclusion-only rows (Multiply 0) and a weight boost (Multiply 2) are modifiers, not lists.
const realShapes = lootTables({
  mob: [
    lootRow("GlobalHostileMobLoot", "SW.Mob.Default.Hostile", [
      slot("Emeralds", 0, 5, 0.025, false, [["SW.Item.Currency.Emerald", 5, "Set"], ["SW.Item.Currency.EmeraldBlock", 1, "Set"]]),
      slot("TNT", 0, 1, 0.0125, false, ["SW.Item.Consumable.Throwable.TNT"]),
      slot("Consumable", 0, 1, 0.0125, false, ["SW.Item.Consumable.Food", ["SW.Item.ExceptFromDefaultLootTables", 0, "Multiply"]]),
      slot("Item", 0, 1, 0.0125, false),
    ]),
    lootRow("SoulStated", "SW.Mob.Default.SoulStated", [slot("Item", 0, 1, 0.25, true)]),
    lootRow("Geomancer", "SW.Mob.Geomancer", [slot("Item", 0, 0, 0, true, [["SW.Item.Property.Artifact", 2, "Multiply"]])]),
    lootRow("LargeSlime", "SW.Mob.Slime", [
      slot("Item", 0, 0, 0, true, [["SW.Item.Property.Gear", 0, "Multiply"], ["SW.Item.Property.EnchantmentBook", 0, "Multiply"]]),
      slot("Emeralds", 0, 0, 0, true, [["SW.Item.Currency.Emerald", 0, "Multiply"]]),
      slot("SpringStone", 0, 0, 0, false, [["SW.Item.Currency.SpringStone", 0, "Multiply"]]),
      slot("TNT", 0, 0, 0, false, [["SW.Item.Consumable.Throwable.TNT", 0, "Multiply"]]),
    ]),
    lootRow("Vex", "SW.Mob.Vex", [
      slot("Item", 0, 0, 0, true, [["SW.Item.Property.Gear", 0, "Multiply"], ["SW.Item.Property.EnchantmentBook", 0, "Multiply"]]),
      slot("Emeralds", 0, 0, 0, true, [["SW.Item.Currency.Emerald", 0, "Multiply"]]),
    ]),
    lootRow("Odd", "SW.Mob.Odd", [slot("Item", 0, 0, 0, true, [["SW.Item.Property.Food", 0, "Multiply"]])]),
    lootRow("WitchType3", "SW.Mob.Witch.Type3", [slot("Item", 0, 0, 0, false)]),
  ],
}).mob;

describe("resolveDrops items of an own list", () => {
  const own = lootTables({ mob: [
    lootRow("Mosstrosity", "SW.Mob.Monstrosity.Moss", [slot("Talismans", 1, 0, 0, true, ["sw.Item.Talisman.Llama"])]),
    lootRow("Boss", "SW.Trait.Boss", [slot("Item", 1, 6, 0.5, true)]),
  ] }).mob;
  const keysOf = (tag: string): string[] => (tag.toLowerCase() === "sw.item.talisman.llama" ? ["talisman/llama"] : []);

  it("names the items the slot adds itself, through the key lookup", () => {
    const drops = resolveDrops(["SW.Mob.Monstrosity.Moss"], ["SW.Trait.Boss", ...HOSTILE], own, keysOf);
    expect(drops?.find((drop) => drop.slot === "talismans")).toEqual({ slot: "talismans", guaranteed: 1, rolls: 0, chancePerRoll: 0, pool: "own", items: ["talisman/llama"] });
  });

  it("names nothing for an area list or a tag that is no item", () => {
    expect(item(resolveDrops(["SW.Mob.Other"], ["SW.Trait.Boss", ...HOSTILE], own, keysOf))).toEqual({ slot: "item", guaranteed: 1, rolls: 6, chancePerRoll: 0.5, pool: "area" });
    expect(resolveDrops(["SW.Mob.Monstrosity.Moss"], ["SW.Trait.Boss", ...HOSTILE], own)?.find((drop) => drop.slot === "talismans")).not.toHaveProperty("items");
  });
});

describe("resolveDrops with modifier and exclusion slots (real shapes)", () => {
  const slots = (drops: ReturnType<typeof resolveDrops>) => drops?.map((drop) => drop.slot);

  it("suppresses the slime's item, emerald and TNT drops; only the consumable roll stays", () => {
    const drops = resolveDrops(["SW.Mob.Slime"], ["SW.Mob.Type1", ...HOSTILE], realShapes);
    expect(drops).toEqual([{ slot: "consumable", guaranteed: 0, rolls: 1, chancePerRoll: 0.0125, pool: "own" }]);
  });

  it("suppresses the vex's item and emerald drops but keeps TNT and consumable", () => {
    expect(slots(resolveDrops(["SW.Mob.Vex"], ["SW.Mob.Type1", ...HOSTILE], realShapes))).toEqual(["consumable", "tnt"]);
  });

  it("also suppresses the Soul Corrupted roll a lower tier row would give", () => {
    const soul = resolveDrops(["SW.Mob.Vex.SoulStated"], ["SW.Mob.Vex", "SW.Mob.Default.SoulStated", ...HOSTILE], realShapes);
    expect(item(soul)).toBeUndefined();
  });

  it("treats the geomancer's artifact weight boost as a modifier: the item slot falls through and is not 'own'", () => {
    const drops = resolveDrops(["SW.Mob.Geomancer"], ["SW.Mob.Type1", ...HOSTILE], realShapes);
    expect(item(drops)).toEqual({ slot: "item", guaranteed: 0, rolls: 1, chancePerRoll: 0.0125, pool: "none" });
    const soul = resolveDrops(["SW.Mob.Geomancer.SoulStated"], ["SW.Mob.Geomancer", "SW.Mob.Default.SoulStated", ...HOSTILE], realShapes);
    expect(item(soul)).toEqual({ slot: "item", guaranteed: 0, rolls: 1, chancePerRoll: 0.25, pool: "area" });
  });

  it("lets an exclusion that does not cover the slot's content fall through as a modifier", () => {
    expect(item(resolveDrops(["SW.Mob.Odd"], HOSTILE, realShapes))).toEqual({ slot: "item", guaranteed: 0, rolls: 1, chancePerRoll: 0.0125, pool: "none" });
  });

  it("lets a genuinely empty 0+0 slot fall through", () => {
    expect(item(resolveDrops(["SW.Mob.Witch.Type3"], HOSTILE, realShapes))).toEqual({ slot: "item", guaranteed: 0, rolls: 1, chancePerRoll: 0.0125, pool: "none" });
  });
});

describe("hasOwnPool", () => {
  it("is true only for a Set entry with weight above 0", () => {
    const row = realShapes.find((candidate) => candidate.Name === "GlobalHostileMobLoot");
    const geomancer = realShapes.find((candidate) => candidate.Name === "Geomancer");
    const consumable = row && slotsOf(row).get("consumable");
    const boost = geomancer && slotsOf(geomancer).get("item");
    expect(consumable && hasOwnPool(consumable)).toBe(true);
    expect(boost && hasOwnPool(boost)).toBe(false);
  });
});

describe("slotsOf / hasPoolTags", () => {
  it("tolerates a row with no slots and skips unknown or empty slot names", () => {
    const bare = lootTables({ mob: [{ Name: "Bare", TypeTag: { TagName: "SW.Mob.Bare" }, LootDropDefinition: {} }] }).mob[0];
    const odd = lootRow("Odd", "SW.Mob.Odd", [slot("", 1, 1, 1, false), slot("Mystery", 1, 1, 1, false), slot("Item", 0, 1, 0.5, false, ["SW.Item.X"])]);
    const row = lootTables({ mob: [odd] }).mob[0];
    expect(bare && slotsOf(bare).size).toBe(0);
    expect(row && [...slotsOf(row).keys()]).toEqual(["item"]);
    const value = row && slotsOf(row).get("item");
    expect(value && hasPoolTags(value)).toBe(true);
  });
});

describe("slotKeyOf", () => {
  it("reads the slot out of the exported tag key", () => {
    expect(slotKeyOf('(TagName="SW.LootSlot.SpringStone")')).toBe("springStone");
    expect(slotKeyOf('(TagName="")')).toBeUndefined();
  });
});

describe("unusedMobRows", () => {
  it("reports, for information, mob loot rows that no mob's tags, traits or Soul Corrupted traits reach", () => {
    const orphan = lootRow("Orphan", "SW.LootSource.PiggyBank.OnHit", [slot("Item", 1, 0, 1, false)]);
    const table = lootTables({ mob: [lootRow("SoulStated", "SW.Mob.Default.SoulStated", []), lootRow("Zombie", "Sw.Mob.Zombie", []), orphan] }).mob;
    const zombie = { tags: ["SW.Mob.Zombie"], closure: ["SW.Mob.Type1"], soul: { tags: ["SW.Mob.Zombie.SoulStated"], closure: ["SW.Mob.Default.SoulStated"] } };
    expect(unusedMobRows([zombie], table)).toEqual([{ type: "mob-loot-row-unused", detail: "Orphan (SW.LootSource.PiggyBank.OnHit)" }]);
  });
});

describe("attachDrops", () => {
  const mob: Mob = { slug: "zombie", id: "Zombie", kind: "regular", world: "overworld", name: loc({ en: "Zombie" }), untranslated: [], stats: [], soulCorrupted: { stats: [], drops: [] }, variants: [], areas: [], drops: [] };
  const draft: MobDraft = { mob, tags: ["SW.Mob.Zombie"], closure: ["SW.Mob.Type1", ...HOSTILE], soul: { tags: ["SW.Mob.Zombie.SoulStated"], closure: ["SW.Mob.Zombie", "SW.Mob.Default.SoulStated", ...HOSTILE] }, references: [] };

  it("fills both the normal and the Soul Corrupted drops in new drafts", () => {
    const { drafts, issues } = attachDrops([draft], rows);
    expect(drafts[0]?.mob.drops[0]?.chancePerRoll).toBe(0.0125);
    expect(drafts[0]?.mob.soulCorrupted?.drops[0]?.chancePerRoll).toBe(0.25);
    expect(draft.mob.drops).toEqual([]);
    expect(issues).toEqual([]);
  });

  it("reports a mob whose loot row cannot be found", () => {
    const odd: MobDraft = { ...draft, mob: { ...mob, slug: "odd" }, tags: ["SW.Mob.Odd"], closure: [], soul: undefined };
    expect(attachDrops([odd], rows).issues).toEqual([{ type: "mob-loot-unresolved", detail: "odd" }]);
  });
});

const hasSourceData = existsSync("source-data/DataTables/UFS/DT_LootSourceDefinition_Mob.json");

describe.skipIf(!hasSourceData)("real source-data", () => {
  it("resolves the real drops of bosses, mini-bosses and regular mobs", async () => {
    const [locales, tables, loot] = await Promise.all([loadLocales("source-data"), loadMobTables("source-data"), loadLootTables("source-data")]);
    if (!tables || !loot) throw new Error("tables missing");
    const { drafts } = buildMobs(tables, locales);
    const { drafts: attached, issues: dropIssues } = attachDrops(drafts, loot.mob);
    const issues = [...dropIssues, ...unusedMobRows(drafts, loot.mob)];
    const find = (slug: string) => attached.find((draft) => draft.mob.slug === slug);
    const itemOf = (drops: readonly { slot: string }[] | undefined) => drops?.find((drop) => drop.slot === "item");
    expect(itemOf(find("zombie")?.mob.drops)).toEqual({ slot: "item", guaranteed: 0, rolls: 1, chancePerRoll: 0.0125, pool: "none" });
    expect(itemOf(find("monstrosity-moss")?.mob.drops)).toEqual({ slot: "item", guaranteed: 1, rolls: 6, chancePerRoll: 0.5, pool: "area" });
    expect(itemOf(find("evoker")?.mob.drops)).toEqual({ slot: "item", guaranteed: 1, rolls: 4, chancePerRoll: 0.25, pool: "area" });
    expect(itemOf(find("maw")?.mob.drops)).toEqual({ slot: "item", guaranteed: 1, rolls: 3, chancePerRoll: 0.15, pool: "none" });
    expect(itemOf(find("zombie")?.mob.soulCorrupted?.drops)).toEqual({ slot: "item", guaranteed: 0, rolls: 1, chancePerRoll: 0.25, pool: "area" });
    expect(issues.filter((item) => item.type === "mob-loot-unresolved")).toEqual([]);   // Bee, Frog and Tuner (no loot row) are not hostile and get no page
    expect(issues.filter((item) => item.type === "mob-loot-row-unused").map((item) => item.detail.split(" ")[0])).toEqual(["PiggyBankOnHit", "DeepDarkIllagerBackpack", "StorminatorBase"]);
  });
});
