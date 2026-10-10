import { describe, expect, it } from "vitest";
import { t } from "../../../src/lib/i18n";
import { RARITY_LABEL, rarityTiers } from "../../../src/lib/rarity";

describe("rarity tiers", () => {
  it("gives unique items their one fixed tier", () => {
    expect(rarityTiers("unique")).toEqual(["unique"]);
  });

  it("lists every tier a non-unique item can have, lowest first", () => {
    expect(rarityTiers("normal")).toEqual(["common", "rare", "special"]);
  });

  it("labels each tier with the game's own words", () => {
    expect(rarityTiers("normal").map((tier) => t("zh", RARITY_LABEL[tier]))).toEqual(["普通", "稀有", "特殊"]);
    expect(t("en", RARITY_LABEL.unique)).toBe("Unique");
  });
});
