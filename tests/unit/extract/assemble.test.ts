import { describe, expect, it } from "vitest";
import { assembleEntry, assertUniqueSlugs } from "../../../scripts/extract/assemble";
import type { RawEntry } from "../../../scripts/extract/group-entries";
import { ExtractError } from "../../../scripts/extract/issues";
import { makeEntry } from "../../helpers/entries";
import { loc } from "../../helpers/localized";

const raw = (overrides: Partial<RawEntry> = {}): RawEntry => ({
  id: "Sword_Unique1",
  category: "melee",
  release: "base",
  untranslated: [],
  name: loc({ zh: "燃燒之刃", en: "The Burning Blade" }),
  ...overrides,
});

describe("assembleEntry", () => {
  it("derives slug and variant and renders descriptions per language", () => {
    const { entry, issues } = assembleEntry(
      raw({ description: loc({ zh: "造成 {0} 傷害。\n好用", en: "Deals {0} damage.\nNice", ja: "{0} ダメージ" }) }),
    );
    expect(entry).toMatchObject({ slug: "sword-unique1", variant: "unique", links: {} });
    expect(entry.description).toMatchObject({
      zh: '造成 <span class="placeholder" data-slot="0">{數值}</span> 傷害。<br>好用',
      en: 'Deals <span class="placeholder" data-slot="0">{value}</span> damage.<br>Nice',
      de: 'Deals <span class="placeholder" data-slot="0">{Wert}</span> damage.<br>Nice',
    });
    expect(entry.description?.ja).toMatch(/^<span class="placeholder" data-slot="0">\{[^}]+\}<\/span> ダメージ$/);
    expect(issues).toEqual([]);
  });

  it("strips markup from names", () => {
    const { entry } = assembleEntry(raw({ name: loc({ zh: "<emphasis>賢者</>腰帶", en: "<emphasis>Sage</> Belt" }) }));
    expect(entry.name).toEqual(loc({ zh: "賢者腰帶", en: "Sage Belt" }));
  });

  it("includes the icon only when given", () => {
    expect(assembleEntry(raw(), "icons/melee/sword-unique1.png").entry.icon).toBe("icons/melee/sword-unique1.png");
    expect("icon" in assembleEntry(raw()).entry).toBe(false);
  });

  it("sets the armor piece for armor entries only", () => {
    expect(assembleEntry(raw({ id: "DiscipleBoots", category: "armor" })).entry.armorPiece).toBe("boots");
    expect("armorPiece" in assembleEntry(raw()).entry).toBe(false);
  });

  it("copies untranslated languages only when present", () => {
    expect(assembleEntry(raw({ untranslated: ["zh"] })).entry.untranslated).toEqual(["zh"]);
    expect("untranslated" in assembleEntry(raw()).entry).toBe(false);
  });

  it("reports markup warnings with the entry location", () => {
    const { issues } = assembleEntry(raw({ id: "Sword", description: loc({ zh: "<foo>x</>", en: "<foo>x</>" }) }));
    expect(issues).toEqual([{ type: "markup-warning", detail: "melee:Sword: unknown tag <foo>" }]);
  });
});

describe("assertUniqueSlugs", () => {
  it("allows the same slug in different categories", () => {
    expect(() => assertUniqueSlugs([makeEntry("Arcane", "enchantment"), makeEntry("Arcane", "status")])).not.toThrow();
  });

  it("throws on a slug collision inside one category", () => {
    const entries = [makeEntry("A", "melee", { slug: "x" }), makeEntry("B", "melee", { slug: "x" })];
    expect(() => assertUniqueSlugs(entries)).toThrow(ExtractError);
    expect(() => assertUniqueSlugs(entries)).toThrow("slug 衝突：melee/x（A、B）");
  });
});
