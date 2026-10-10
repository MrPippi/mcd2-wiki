import { describe, expect, it } from "vitest";
import { buildUiGameStrings } from "../../../scripts/extract/ui-game-strings";
import keys from "../../../scripts/extract/ui-game-keys.json";
import { makeLocales, ns } from "../../helpers/locales";
import { loc } from "../../helpers/localized";

const LOCALES = makeLocales({
  [ns("InventoryLabels")]: { header_armor: { en: "Armor", zh: "護甲", ru: "Броня" }, Equipment_Helmet: { en: "Helmet", zh: "" } },
});

describe("buildUiGameStrings", () => {
  it("maps site keys to the game's text in every language", () => {
    const result = buildUiGameStrings(LOCALES, {
      categoryArmor: { namespace: ns("InventoryLabels"), key: "header_armor" },
      pieceHelmet: { namespace: ns("InventoryLabels"), key: "Equipment_Helmet" },
    });
    expect(result.strings.categoryArmor).toEqual(loc({ en: "Armor", zh: "護甲", ru: "Броня" }));
    expect(result.strings.pieceHelmet).toMatchObject({ en: "Helmet" });
    expect(result.issues).toEqual([]);
  });

  it("stores only the languages the game has, so a language file can fill the rest", () => {
    const locales = makeLocales({ [ns("InventoryLabels")]: { header_armor: { en: "Armor", zh: "護甲", ko: "" } } });
    const result = buildUiGameStrings(locales, { categoryArmor: { namespace: ns("InventoryLabels"), key: "header_armor" } });
    expect(result.strings.categoryArmor).toMatchObject({ en: "Armor", zh: "護甲" });
    expect(result.strings.categoryArmor).not.toHaveProperty("ko");
  });

  it("leaves out a key the game does not have and reports it", () => {
    const result = buildUiGameStrings(LOCALES, { missing: { namespace: ns("InventoryLabels"), key: "nope" } });
    expect(result.strings.missing).toBeUndefined();
    expect(result.issues).toHaveLength(1);
  });

  it("maps every site key the spec requires", () => {
    for (const key of ["categoryMelee", "categoryArmor", "pieceHelmet", "pieceBoots", "rarityCommon", "rarityRare", "raritySpecial", "unique", "map", "markerRift", "markerMinecart", "markerPortal"]) {
      expect(Object.keys(keys)).toContain(key);
    }
  });
});
