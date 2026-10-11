import { describe, expect, it } from "vitest";
import type { ResolvedItemSources, ResolvedSource } from "../../../src/lib/item-sources";
import {
  areaHref,
  entrySources,
  hasAnySource,
  merchantCategoryLabel,
  mergeSources,
  groupIsUntranslated,
  nameIsUntranslated,
  showsAltName,
} from "../../../src/lib/item-source-view";
import { categoryLabel } from "../../../src/lib/i18n";
import { href } from "../../../src/lib/url";
import { makeEntry } from "../../helpers/entries";
import { loc } from "../../helpers/localized";

const src = (id: string, untranslated: ResolvedSource["untranslated"] = []): ResolvedSource => ({
  id,
  kind: "chest",
  name: loc({ en: id }),
  untranslated,
});
const empty: ResolvedItemSources = { areas: [], chests: [], quests: [], merchants: [], bookPools: [] };

describe("merchantCategoryLabel", () => {
  it("labels the stored pool tag, not the page's category", () => {
    expect(merchantCategoryLabel("SW.Item.Property.MeleeWeapon", "zh")).toBe(categoryLabel("melee", "zh"));
    expect(merchantCategoryLabel("SW.Item.Property.Armor", "en")).toBe(categoryLabel("armor", "en"));
  });

  it("fails loudly on a tag it does not know", () => {
    expect(() => merchantCategoryLabel("SW.Item.Property.Nothing", "en")).toThrow(/Nothing/);
  });
});

describe("nameIsUntranslated", () => {
  it("marks only the listed languages, never English", () => {
    const source = src("a", ["de", "en"]);
    expect(nameIsUntranslated(source, "de")).toBe(true);
    expect(nameIsUntranslated(source, "ja")).toBe(false);
    expect(nameIsUntranslated(source, "en")).toBe(false);
  });
});

describe("groupIsUntranslated", () => {
  it("is true only when every source in a non-empty group fell back to English for the language", () => {
    expect(groupIsUntranslated([src("a", ["zh"]), src("b", ["zh", "de"])], "zh")).toBe(true);
    expect(groupIsUntranslated([src("a", ["zh"]), src("b")], "zh")).toBe(false);
    expect(groupIsUntranslated([src("a", ["en"])], "en")).toBe(false);
    expect(groupIsUntranslated([], "zh")).toBe(false);
  });
});

describe("showsAltName", () => {
  const named = (zh: string, untranslated: ResolvedSource["untranslated"] = []): ResolvedSource => ({ ...src("x", untranslated), name: loc({ en: "Chest: X", zh }) });
  it("shows the comparison name only when it differs and the page name is a real translation", () => {
    expect(showsAltName(named("寶箱 X"), "zh")).toBe(true);
    expect(showsAltName(named("寶箱：X", ["zh"]), "zh")).toBe(false);
    expect(showsAltName(named("Chest: X"), "zh")).toBe(false);
  });

  it("hides the comparison name when that language itself fell back to English", () => {
    expect(showsAltName(named("寶箱：X", ["zh"]), "en")).toBe(false);
    expect(showsAltName(named("寶箱 X"), "en")).toBe(true);
  });
});

describe("hasAnySource / mergeSources", () => {
  it("is false for an empty record", () => {
    expect(hasAnySource(empty)).toBe(false);
    expect(hasAnySource({ ...empty, areas: [src("x")] })).toBe(true);
  });

  it("merges several records and drops repeated ids", () => {
    const a: ResolvedItemSources = { ...empty, bookPools: [src("p1"), src("p2")] };
    const b: ResolvedItemSources = { ...empty, bookPools: [src("p2")], areas: [src("x")] };
    const merged = mergeSources([a, b]);
    expect(merged.bookPools.map((s) => s.id)).toEqual(["p1", "p2"]);
    expect(merged.areas).toHaveLength(1);
    expect(a.bookPools).toHaveLength(2);
  });
});

describe("areaHref", () => {
  it("opens the map at the area's marker when the mob data has one", () => {
    expect(areaHref("en", "area:SW.Area.Carapace.A1", loc({ en: "Humbler Huskland" }))).toBe("/en/map/?world=sift#4/3317/5463");
  });

  it("falls back to the plain map page", () => {
    expect(areaHref("en", "area:SW.Area.Nowhere", loc({ en: "Nowhere" }))).toBe(href("en", "map"));
  });
});

describe("entrySources", () => {
  it("reads an item by category and slug", () => {
    expect(entrySources(makeEntry("Sickles", "melee"))?.areas.length).toBeGreaterThan(0);
  });

  it("gives undefined for an item the game data lists no source for", () => {
    expect(entrySources(makeEntry("NoSuchThing", "melee"))).toBeUndefined();
  });

  it("collects an enchantment's sources from its books", () => {
    const sources = entrySources(makeEntry("Piercing", "enchantment"));
    expect(sources?.quests.map((quest) => quest.id)).toContain("quest:QuestEnchantsmithBookReward");
  });
});
