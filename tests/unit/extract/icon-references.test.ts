import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { ExtractError } from "../../../scripts/extract/issues";
import { buildIconReferences, loadIconReferences, referencePaths, referenceFor, rowKey } from "../../../scripts/extract/icon-references";

describe("referencePaths", () => {
  it("maps /Game/Spicewood references into Assets", () => {
    expect(referencePaths("/Game/Spicewood/Art/Weapons/T_UI_Pike_Icon.T_UI_Pike_Icon")).toEqual(["Assets/Art/Weapons/T_UI_Pike_Icon.png"]);
  });
  it("tries the plugin content folder, then Assets, for plugin references", () => {
    expect(referencePaths("/OreUI/UI/Icons/Statuses/T_UI_Icon_Status_Burning.T_UI_Icon_Status_Burning")).toEqual([
      "Plugins/OreUI/Content/UI/Icons/Statuses/T_UI_Icon_Status_Burning.png",
      "Assets/UI/Icons/Statuses/T_UI_Icon_Status_Burning.png",
    ]);
  });
  it("returns nothing for None, empty or malformed references", () => {
    expect(referencePaths("None")).toEqual([]);
    expect(referencePaths("")).toEqual([]);
    expect(referencePaths("nonsense")).toEqual([]);
  });
});

describe("rowKey", () => {
  it("lowercases and turns dots into underscores", () => {
    expect(rowKey("MaulerDive.Unique")).toBe("maulerdive_unique");
  });
});

const refs = buildIconReferences({
  melee: [{ Name: "Axe", IconReference: "/Game/Spicewood/A.A" }],
  "enchantment-book": [
    { Name: "Arcane", IconReference: "/Game/Spicewood/BookArcane.X" },
    { Name: "Plain", IconReference: "None" },
  ],
  enchantment: [
    { Name: "Arcane", IconReference: "/Game/Spicewood/EnchArcane.X" },
    { Name: "Plain", IconReference: "/Game/Spicewood/EnchPlain.X" },
    { Name: "MaulerDive.Unique", IconReference: "/Game/Spicewood/Mauler.X" },
  ],
});

describe("referenceFor", () => {
  it("finds a row by lowercased id", () => {
    expect(referenceFor(refs, "melee", "Axe")).toBe("/Game/Spicewood/A.A");
    expect(referenceFor(refs, "melee", "Sword")).toBeUndefined();
  });
  it("strips the EnchantmentBook_ prefix and prefers the book row", () => {
    expect(referenceFor(refs, "enchantment-book", "EnchantmentBook_Arcane")).toBe("/Game/Spicewood/BookArcane.X");
  });
  it("falls back to the enchantment row only when the book row has no reference", () => {
    expect(referenceFor(refs, "enchantment-book", "EnchantmentBook_Plain")).toBe("/Game/Spicewood/EnchPlain.X");
  });
  it("falls back to the _unique row", () => {
    expect(referenceFor(refs, "enchantment", "MaulerDive")).toBe("/Game/Spicewood/Mauler.X");
    expect(referenceFor(refs, "enchantment-book", "EnchantmentBook_MaulerDive")).toBe("/Game/Spicewood/Mauler.X");
  });
  it("returns nothing for categories without a table", () => {
    expect(referenceFor(refs, "skin", "Axe")).toBeUndefined();
  });
});

describe("loadIconReferences", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "mcd2-refs-"));
  });
  const put = async (name: string, content: string) => {
    const dir = path.join(root, "DataTables", "UFS");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${name}.json`), content, "utf8");
  };

  it("is empty without a DataTables folder", async () => {
    expect(referenceFor(await loadIconReferences(root), "melee", "Axe")).toBeUndefined();
  });
  it("reads rows from the category tables and skips missing tables", async () => {
    await put("DT_ItemDefinitionMelee", JSON.stringify([{ Name: "Axe", IconReference: "/Game/Spicewood/A.A" }, { Name: "Other" }]));
    const loaded = await loadIconReferences(root);
    expect(referenceFor(loaded, "melee", "Axe")).toBe("/Game/Spicewood/A.A");
    expect(referenceFor(loaded, "melee", "Other")).toBeUndefined();
  });
  it("fails clearly on a malformed table", async () => {
    await put("DT_ItemDefinitionMelee", JSON.stringify({ not: "an array" }));
    await expect(loadIconReferences(root)).rejects.toBeInstanceOf(ExtractError);
  });
});
