import { describe, expect, it } from "vitest";
import { findEntry } from "../../../src/lib/data";
import { relatedLinks } from "../../../src/lib/related";
import { makeEntry } from "../../helpers/entries";

describe("relatedLinks", () => {
  it("links a weapon to its other variant", () => {
    const sword = findEntry("melee", "sword");
    expect(sword).toBeDefined();
    expect(relatedLinks("zh", sword!)).toContainEqual({
      labelKey: "relatedVariant",
      href: "/zh/melee/sword-unique1/",
      name: findEntry("melee", "sword-unique1")?.name,
      icon: "icons/melee/sword-unique1.png",
      category: "melee",
      variant: "unique",
    });
  });

  it("names the variant in every language", () => {
    const link = relatedLinks("ja", findEntry("melee", "sword")!).find((l) => l.labelKey === "relatedVariant");
    expect(link?.href).toBe("/ja/melee/sword-unique1/");
    expect(link?.name).toMatchObject({ zh: "燃燒之刃", en: "The Burning Blade" });
  });

  it("links an armor piece to its set", () => {
    const helmet = findEntry("armor", "disciple-helmet");
    expect(relatedLinks("en", helmet!)).toContainEqual(
      expect.objectContaining({ labelKey: "armorSet", href: "/en/armor/disciple/", category: "armor" }),
    );
  });

  it("shows an armor set with its first piece's icon", () => {
    const helmet = findEntry("armor", "disciple-helmet");
    const setLink = relatedLinks("zh", helmet!).find((link) => link.labelKey === "armorSet");
    expect(setLink?.icon).toBe(helmet!.icon);
  });

  it("does not link enchantments to separate book pages", () => {
    const arcane = findEntry("enchantment", "arcane");
    expect(relatedLinks("zh", arcane!).map((link) => link.labelKey)).not.toContain("enchantmentBook");
  });

  it("drops links whose target does not exist", () => {
    const orphan = makeEntry("Ghost", "melee", { links: { variants: ["no-such-slug"], armorSet: "nope" } });
    expect(relatedLinks("zh", orphan)).toEqual([]);
  });
});
