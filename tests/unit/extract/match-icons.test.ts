import { describe, expect, it } from "vitest";
import { buildIconIndex, matchIcon, tokenize } from "../../../scripts/extract/match-icons";

const FILES = [
  "E/Weapons/Sword/T_UI_Sword_Icon.png",
  "E/Weapons/Sword/Sword_Unique/T_UI_Sword_Unique_Icon.png",
  "E/Weapons/Moonsword/T_UI_Moonsword_Icon.png",
  "E/Armor/Disciple_Armor/T_UI_Boots_Disciple_Icon.png",
  "E/Armor/Mystic_Armor/T_UI_MysticChestplate_Icon.png",
  "E/Armor/Stalwart_Armor/T_UI_Chest_Stalwart_Icon_png.png",
  "E/Armor/Realmreacher_Armor/T_UI_Helmet_Realmreacher.png",
  "E/Weapons/Gauntlets/T_UI_Gauntlets_Icon.png",
  "E/Artifacts/Satchels/T_UI_Icon_Satchel_Fire.png",
  "E/Artifacts/TotemOfShielding/T_UI_TotemofShielding_Icon.png",
  "E/Dupes/A/T_UI_Twin_Icon.png",
  "E/Dupes/B/T_UI_Twin_Icon.png",
];
const index = buildIconIndex(FILES);

describe("tokenize", () => {
  it("drops noise tokens and normalises aliases", () => {
    expect(tokenize("T_UI_Chest_Stalwart_Icon_png")).toEqual(["chest", "stalwart"]);
    expect(tokenize("T_UI_MysticChestplate_Icon")).toEqual(["mystic", "chest"]);
    expect(tokenize("Sword_Unique1")).toEqual(["sword", "unique"]);
  });
});

describe("matchIcon", () => {
  it.each([
    ["Sword", FILES[0]],
    ["Sword_Unique1", FILES[1]],
    ["MoonSword", FILES[2]],
    ["DiscipleBoots", FILES[3]],
    ["MysticChest", FILES[4]],
    ["StalwartChest", FILES[5]],
    ["RealmreacherHelmet", FILES[6]],
    ["Gauntlet", FILES[7]],
    ["Artifact_Satchel_Fire", FILES[8]],
    ["Artifact_TotemOfShielding", FILES[9]],
  ])("auto-matches %s", (id, file) => {
    expect(matchIcon(id, index, {})).toEqual({ kind: "matched", file, via: "auto" });
  });

  it("reports ambiguous candidates", () => {
    expect(matchIcon("Twin", index, {})).toEqual({ kind: "ambiguous", candidates: [FILES[10], FILES[11]] });
  });

  it("reports a missing icon", () => {
    expect(matchIcon("Nothing", index, {})).toEqual({ kind: "missing" });
  });

  it("prefers an override path", () => {
    expect(matchIcon("Sword", index, { Sword: "custom/x.png" })).toEqual({
      kind: "matched",
      file: "custom/x.png",
      via: "override",
    });
  });

  it("treats a null override as an explicit no-icon", () => {
    expect(matchIcon("Sword", index, { Sword: null })).toEqual({ kind: "none" });
  });
});

describe("matchIcon — enchantment and status icons", () => {
  const ENCHANTS = ["U/Enchantments/T_UI_Icon_Enchantment_Arcane.png", "U/Enchantments/T_UI_Icon_Enchantment_FireAspect.png"];
  const STATUSES = ["U/Statuses/T_UI_Icon_Status_Burning.png", "U/Statuses/T_UI_Icon_Status_FireBracelet.png"];
  const enchantIndex = buildIconIndex(ENCHANTS);
  const statusIndex = buildIconIndex(STATUSES);

  it("drops status, enchantment and buff tokens", () => {
    expect(tokenize("T_UI_Icon_Status_FireBracelet")).toEqual(["fire", "bracelet"]);
    expect(tokenize("Artifact_Buff_FireBracelet")).toEqual(["artifact", "fire", "bracelet"]);
  });

  it("matches enchantments and their books by id", () => {
    expect(matchIcon("Arcane", enchantIndex, {})).toEqual({ kind: "matched", file: ENCHANTS[0], via: "auto" });
    expect(matchIcon("EnchantmentBook_Arcane", enchantIndex, {})).toEqual({ kind: "matched", file: ENCHANTS[0], via: "auto" });
  });

  it("matches artifact buff statuses", () => {
    expect(matchIcon("Artifact_Buff_FireBracelet", statusIndex, {})).toEqual({ kind: "matched", file: STATUSES[1], via: "auto" });
  });

  it("falls back to the base id only when asked", () => {
    expect(matchIcon("Burning_Infinite", statusIndex, {})).toEqual({ kind: "missing" });
    expect(matchIcon("Burning_Infinite", statusIndex, {}, { fallbackToBase: true })).toEqual({
      kind: "matched",
      file: STATUSES[0],
      via: "fallback",
    });
    expect(matchIcon("EnchantmentBook_FireAspect_II", enchantIndex, {}, { fallbackToBase: true })).toEqual({
      kind: "matched",
      file: ENCHANTS[1],
      via: "fallback",
    });
  });
});
