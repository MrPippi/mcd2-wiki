import { describe, expect, it } from "vitest";
import { armorPieceOf, baseId, parseKey, toSlug, variantOf } from "../../../scripts/extract/keys";

describe("parseKey", () => {
  it("splits kind, id and field", () => {
    expect(parseKey("SW_Item_Sword_Unique1_SW_TextEntry_Name")).toEqual({
      kind: "Item",
      id: "Sword_Unique1",
      field: "Name",
    });
  });

  it("keeps multi-part field names", () => {
    expect(parseKey("SW_Effect_Vivify_SW_TextEntry_Description_Long")?.field).toBe("Description_Long");
  });

  it("accepts the lowercase Sw_ prefix found in real data", () => {
    expect(parseKey("Sw_Effect_Taunter_SW_TextEntry_Name")).toEqual({ kind: "Effect", id: "Taunter", field: "Name" });
  });

  it("rejects keys without an id", () => {
    expect(parseKey("SW_Enchantment_SW_TextEntry_Name_Tiered")).toBeNull();
  });

  it("rejects unrelated keys", () => {
    expect(parseKey("AccountLink.Title")).toBeNull();
  });
});

describe("toSlug", () => {
  it.each([
    ["Sword", "sword"],
    ["Sword_Unique1", "sword-unique1"],
    ["MoonSword", "moon-sword"],
    ["Artifact_FireBracelet", "fire-bracelet"],
    ["EnchantmentBook_SoulInfusedPotion", "soul-infused-potion"],
    ["TotemOfRegeneration", "totem-of-regeneration"],
    ["DiscipleBoots_Unique", "disciple-boots-unique"],
    ["Artifact_Buff_FireBracelet", "buff-fire-bracelet"],
    ["XPGain", "xp-gain"],
  ])("%s → %s", (id, slug) => {
    expect(toSlug(id)).toBe(slug);
  });
});

describe("baseId / variantOf", () => {
  it("removes unique suffixes", () => {
    expect(baseId("Sword_Unique1")).toBe("Sword");
    expect(baseId("DiscipleBoots_Unique")).toBe("DiscipleBoots");
    expect(baseId("Sword")).toBe("Sword");
  });

  it("detects unique variants", () => {
    expect(variantOf("Sword_Unique1")).toBe("unique");
    expect(variantOf("DiscipleBoots_Unique")).toBe("unique");
    expect(variantOf("Sword")).toBe("normal");
  });
});

describe("armorPieceOf", () => {
  it.each([
    ["DiscipleHelmet", "helmet"],
    ["WellspringChest_Unique", "chest"],
    ["SifterLeggings", "leggings"],
    ["DiscipleBoots", "boots"],
    ["Sword", undefined],
  ])("%s → %s", (id, piece) => {
    expect(armorPieceOf(id)).toBe(piece);
  });
});
