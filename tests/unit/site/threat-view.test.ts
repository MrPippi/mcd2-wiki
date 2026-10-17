import { describe, expect, it } from "vitest";
import { guidesData } from "../../../src/lib/guides";
import { headerCells, threatColumns } from "../../../src/lib/threat-view";

describe("threatColumns", () => {
  it("lists every part of the extracted data in table order", () => {
    expect(threatColumns(guidesData.threat, "en").map((column) => column.id)).toEqual([
      "recommended", "attack", "resistance", "tier-1", "tier-2", "tier-3",
      "rarity-common", "rarity-rare", "rarity-special", "rarity-unique", "variant", "soul-stated", "miniboss",
    ]);
  });

  it("leaves out a part no row has, and writes missing cells as undefined", () => {
    const rows = [{ level: 1, attackPower: 1 }, { level: 2 }];
    const columns = threatColumns(rows, "en");
    expect(columns.map((column) => column.id)).toEqual(["attack"]);
    expect(columns[0].value(rows[1])).toBeUndefined();
    expect(columns[0].value(rows[0])).toBe("×1");
  });
});

describe("headerCells", () => {
  it("spans each group once and keeps stand-alone columns on their own", () => {
    const cells = headerCells(threatColumns(guidesData.threat, "en"), "en");
    expect(cells.map((cell) => [cell.label, cell.span, cell.column?.id])).toEqual([
      ["Recommended level", 1, "recommended"], ["Your attack power", 1, "attack"], ["Your damage resistance", 1, "resistance"],
      ["Effect tier chance", 3, undefined], ["Drop chance by rarity", 4, undefined], ["Mob spawning", 3, undefined],
    ]);
  });
});
