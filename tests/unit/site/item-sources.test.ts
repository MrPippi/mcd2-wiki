import { describe, expect, it } from "vitest";
import type { ItemSourcesData } from "../../../scripts/extract/mob-schema";
import { sourcesFor } from "../../../src/lib/item-sources";
import { loc } from "../../helpers/localized";

const data: ItemSourcesData = {
  sources: {
    "chest:FancyChest": { kind: "chest", name: loc({ en: "Chest: Fancy Chest" }), untranslated: ["ja"] },
    "quest:QuestArmourMushroomSet": { kind: "quest", name: loc({ en: "Quest reward: Armour Mushroom Set" }), untranslated: [] },
  },
  items: {
    "armor/mushroom-chest": {
      areas: [],
      chests: [{ id: "chest:FancyChest", pool: "area" }],
      quests: [{ id: "quest:QuestArmourMushroomSet", picks: { count: 2, of: 4 } }],
      merchants: [],
      bookPools: [],
    },
    "melee/broken": { areas: ["area:Nowhere"], chests: [], quests: [], merchants: [], bookPools: [] },
  },
};

describe("sourcesFor", () => {
  it("joins each id with its name and keeps the per-item details", () => {
    const view = sourcesFor(data, "armor/mushroom-chest");
    expect(view?.chests).toEqual([{ id: "chest:FancyChest", kind: "chest", name: data.sources["chest:FancyChest"]?.name, untranslated: ["ja"], pool: "area" }]);
    expect(view?.quests[0]?.picks).toEqual({ count: 2, of: 4 });
  });

  it("gives undefined for an item with no sources", () => {
    expect(sourcesFor(data, "melee/sword")).toBeUndefined();
  });

  it("fails loudly on an id with no source entry", () => {
    expect(() => sourcesFor(data, "melee/broken")).toThrow(/area:Nowhere/);
  });
});
