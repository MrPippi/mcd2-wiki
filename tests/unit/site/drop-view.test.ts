import { describe, expect, it } from "vitest";
import { findEntry, publishedEntries } from "../../../src/lib/data";
import { dropData, dropGroupsOf, dropKeysOf, dropRowsOf, DEFAULT_SELECTION, VISIBLE_ROWS } from "../../../src/lib/drop-view";
import { itemRows } from "../../../src/lib/drop-odds";
import { areaLabel, sourceIndex, sourceLabel } from "../../../src/lib/drop-labels";
import { t } from "../../../src/lib/i18n";

const entry = (category: Parameters<typeof findEntry>[0], slug: string) => {
  const found = findEntry(category, slug);
  if (!found) throw new Error(`no ${category}/${slug}`);
  return found;
};

describe("dropKeysOf", () => {
  it("is the item's own key, and for an enchantment the keys of its books", () => {
    expect(dropKeysOf(entry("melee", "war-hammer"))).toEqual(["melee/war-hammer"]);
    expect(dropKeysOf(entry("enchantment", "channeling"))).toEqual(["enchantment-book/channeling"]);
  });

  it("is empty for a page that is not an item", () => {
    expect(dropKeysOf(entry("effect", "sharpness"))).toEqual([]);
  });
});

describe("dropRowsOf", () => {
  it("uses the highest threat level on Normal for any rarity, and lists the best source first", () => {
    expect(DEFAULT_SELECTION).toEqual({ level: dropData.levels.at(-1), difficulty: "normal", rarity: "any" });
    const rows = dropRowsOf(entry("armor", "frost-rime-chest-unique"));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((row) => row.probability)).toEqual([...rows.map((row) => row.probability)].sort((a, b) => b - a));
  });

  it("gives a fixed-contents talisman chest's talisman for sure", () => {
    const rows = dropRowsOf(entry("talisman", "plummeting"));
    expect(rows.find((row) => row.source === "chest:TalismansChest_Plummeting")?.probability).toBeCloseTo(1);
  });

  it("is built once per item", () => {
    const item = entry("melee", "war-hammer");
    expect(dropRowsOf(item)).toBe(dropRowsOf(item));
  });
});

describe("several books of one enchantment", () => {
  it("combine as the chance of at least one of them, which no single book beats", () => {
    const books = dropData.items.filter((item) => item.key.startsWith("enchantment-book/")).slice(0, 2).map((item) => item.key);
    const both = itemRows(dropData, books, DEFAULT_SELECTION);
    const first = itemRows(dropData, books[0], DEFAULT_SELECTION);
    expect(both.length).toBeGreaterThanOrEqual(first.length);
    for (const row of first) {
      const joint = both.find((one) => one.source === row.source && one.area === row.area);
      expect(joint?.probability).toBeGreaterThanOrEqual(row.probability);
    }
  });
});

describe("dropGroupsOf", () => {
  it("covers every published gear piece, book and talisman that has a source in the data", () => {
    const covered = new Set(dropData.items.map((item) => item.key));
    const listed = publishedEntries.filter((one) => covered.has(`${one.category}/${one.slug}`) && one.category !== "enchantment-book");
    expect(listed.length).toBeGreaterThan(200);
    expect(listed.filter((one) => dropGroupsOf(one, "en").length === 0).map((one) => `${one.category}/${one.slug}`)).toEqual([]);
  }, 60_000);

  it("groups by kind in a fixed order, best first inside a group", () => {
    const groups = dropGroupsOf(entry("armor", "frost-rime-chest-unique"), "en");
    expect(groups.map((group) => group.kind)).toEqual(["chest", "mob", "quest"].filter((kind) => groups.some((group) => group.kind === kind)));
    for (const group of groups) {
      const values = group.rows.map((row) => row.probability);
      expect(values).toEqual([...values].sort((a, b) => b - a));
      expect(group.rows.every((row) => row.chance.endsWith("%"))).toBe(true);
    }
  });

  it("keeps the first rows visible and the rest for the fold", () => {
    const long = dropGroupsOf(entry("armor", "frost-rime-chest-unique"), "en").find((group) => group.rows.length > VISIBLE_ROWS);
    if (long) {
      expect(long.visible).toHaveLength(VISIBLE_ROWS);
      expect(long.visible.concat(long.folded)).toEqual(long.rows);
    }
    expect(dropGroupsOf(entry("talisman", "plummeting"), "en").every((group) => group.folded.length === group.rows.length - group.visible.length)).toBe(true);
  });

  it("is empty for an item the data has no source for and for a page that is not an item", () => {
    expect(dropGroupsOf(entry("effect", "sharpness"), "en")).toEqual([]);
  });
});

describe("labels", () => {
  it("builds the source index once per list", () => {
    expect(sourceIndex(dropData.sources)).toBe(sourceIndex(dropData.sources));
    expect(sourceIndex(dropData.sources).byId.get("chest:FancyChest")?.kind).toBe("chest");
  });

  it("flags a chest or mob the data does not place, and shows no flag for one it does", () => {
    const placed = dropData.sources.find((one) => one.id === "chest:FancyChest");
    const unplaced = dropData.sources.find((one) => one.unplaced);
    expect(placed && sourceLabel("en", placed).unplaced).toBeUndefined();
    expect(unplaced && sourceLabel("en", unplaced).unplaced).toBe(true);
  });

  it("names a quest reward batch with its quest, whether it is the first completion, and its number", () => {
    const source = dropData.sources.find((one) => one.kind === "quest" && one.first);
    if (!source) throw new Error("no first-completion quest batch in the data");
    const label = sourceLabel("en", source);
    expect(label.note).toContain(t("en", "questFirstCompletion"));
    expect(label.href).toMatch(/\/quests\//);
    expect(label.name.length).toBeGreaterThan(0);
  });

  it("numbers repeat batches from 1 again", () => {
    const quest = dropData.sources.filter((one) => one.kind === "quest" && !one.first).map((one) => one.id.split(":")[1]);
    const id = quest.find((name) => dropData.sources.some((one) => one.id.startsWith(`quest:${name}:`) && one.first));
    const batch = dropData.sources.find((one) => one.id.startsWith(`quest:${id}:`) && !one.first);
    expect(batch && sourceLabel("en", batch, dropData.sources).note).toContain(t("en", "dropQuestBatch").replace("{n}", "1"));
  });

  it("names a mob with a link to its page and a procedural chest after the chest it extends", () => {
    const mob = dropData.sources.find((one) => one.kind === "mob");
    expect(mob && sourceLabel("en", mob).href).toMatch(/\/mobs\//);
    const procedural = dropData.sources.find((one) => one.id.endsWith("_Procedural"));
    if (!procedural) throw new Error("no procedural chest in the data");
    const label = sourceLabel("en", procedural);
    expect(label.note).toBe(t("en", "dropProcedural"));
    expect(label.name).toBe(sourceLabel("en", { ...procedural, id: procedural.id.replace("_Procedural", "") }).name);
  });

  it("falls back to the id for a source nothing names", () => {
    expect(sourceLabel("en", { id: "chest:Nowhere", kind: "chest", contexts: [] }).name).toBe("Nowhere");
    expect(areaLabel("en", "area:SW.Area.Nowhere")).toBeUndefined();
    expect(areaLabel("en", "")).toBeUndefined();
  });

  it("names an area from the item sources, linked where the map knows it", () => {
    const area = dropData.sources.flatMap((one) => one.contexts.map(([id]) => id)).find((id) => id.startsWith("area:"));
    expect(area && areaLabel("en", area)?.name.length).toBeGreaterThan(0);
  });
});
