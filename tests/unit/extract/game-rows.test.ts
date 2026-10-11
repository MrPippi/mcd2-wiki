import { describe, expect, it } from "vitest";
import { locId } from "../../../scripts/extract/game-rows";

const texts = (key: string) => ({ Texts: { '(TagName="SW.TextEntry.Name")': { Text: `LOCTABLE("DT_ItemDefinitionTalisman.csv", "${key}")` } } });

describe("locId", () => {
  it("reads the id out of the name key", () => {
    expect(locId(texts("SW_Item_Sword_SW_TextEntry_Name"))).toBe("Sword");
  });

  it("ignores the case of the key prefix (the real Wonderful Wheat key starts with sw_Item_)", () => {
    expect(locId(texts("sw_Item_Talisman_Llama_SW_TextEntry_Name"))).toBe("Talisman_Llama");
  });

  it("returns undefined for a key that is not an item, effect or enchantment", () => {
    expect(locId(texts("SW_Mob_Zombie_SW_TextEntry_Name"))).toBeUndefined();
  });
});
