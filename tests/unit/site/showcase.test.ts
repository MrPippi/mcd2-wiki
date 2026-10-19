import { describe, expect, it } from "vitest";
import type { Entry } from "../../../shared/schemas";
import { pickShowcase } from "../../../src/lib/showcase";

const entry = (slug: string, category: Entry["category"], variant: Entry["variant"], icon?: string): Entry =>
  ({ slug, category, variant, icon, name: { zh: slug, en: slug } }) as Entry;

describe("pickShowcase", () => {
  it("takes one entry per category, preferring a unique one with an icon", () => {
    const entries = [
      entry("axe", "melee", "normal", "a.png"),
      entry("axe-unique", "melee", "unique", "b.png"),
      entry("bow", "ranged", "normal", "c.png"),
    ];
    expect(pickShowcase(entries, ["melee", "ranged"]).map((e) => e.slug)).toEqual(["axe-unique", "bow"]);
  });

  it("skips entries without icons and categories with nothing to show", () => {
    const entries = [entry("ghost", "melee", "unique"), entry("sword", "melee", "normal", "s.png")];
    expect(pickShowcase(entries, ["melee", "effect"]).map((e) => e.slug)).toEqual(["sword"]);
  });

  it("does not change the input", () => {
    const entries = Object.freeze([entry("axe", "melee", "normal", "a.png")]);
    expect(() => pickShowcase(entries, ["melee"])).not.toThrow();
  });
});
