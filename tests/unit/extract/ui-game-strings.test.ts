import { describe, expect, it } from "vitest";
import { buildUiGameStrings } from "../../../scripts/extract/ui-game-strings";
import keys from "../../../scripts/extract/ui-game-keys.json";
import { makeLocales, ns } from "../../helpers/locales";

const LOCALES = makeLocales({
  [ns("InventoryLabels")]: { header_armor: ["Armor", "護甲"], Equipment_Helmet: ["Helmet", ""] },
});

describe("buildUiGameStrings", () => {
  it("maps site keys to the game's text in every language", () => {
    const result = buildUiGameStrings(LOCALES, {
      categoryArmor: { namespace: ns("InventoryLabels"), key: "header_armor" },
      pieceHelmet: { namespace: ns("InventoryLabels"), key: "Equipment_Helmet" },
    });
    expect(result.strings.categoryArmor).toEqual({ en: "Armor", zh: "護甲" });
    expect(result.strings.pieceHelmet).toEqual({ en: "Helmet", zh: "Helmet" });
    expect(result.issues).toEqual([]);
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
