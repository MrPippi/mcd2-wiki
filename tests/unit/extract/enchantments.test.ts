import { describe, expect, it } from "vitest";
import { buildEnchantmentData, enchantmentValues } from "../../../scripts/extract/enchantments";
import type { Entry } from "../../../scripts/extract/schemas";
import { TABLES } from "../../helpers/datatables";

const entry = (category: Entry["category"], slug: string, id: string, variant: Entry["variant"] = "normal"): Entry => ({
  id,
  slug,
  category,
  variant,
  release: "base",
  name: { zh: id, en: id },
  links: {},
});

const ENTRIES: readonly Entry[] = [
  entry("enchantment", "fire-aspect", "FireAspect"),
  entry("enchantment", "ricochet", "Ricochet"),
  entry("enchantment", "gravity-pulse-unique", "GravityPulse_Unique", "unique"),
];

const row = (name: string) => {
  const found = TABLES.enchantments.find((candidate) => candidate.Name === name);
  if (!found) throw new Error(`no fixture row ${name}`);
  return found;
};

describe("enchantmentValues", () => {
  it("reads the base ability value for a tier with no specialization", () => {
    expect(enchantmentValues(row("FireAspect.I"), TABLES.enchantments)).toEqual(["35%"]);
  });

  it("applies a tier's Override specialization to the base ability", () => {
    expect(enchantmentValues(row("FireAspect.II"), TABLES.enchantments)).toEqual(["45%"]);
  });

  it("finds a text-less unique row's family through its traits", () => {
    expect(enchantmentValues(row("FlameBelch.Unique"), TABLES.enchantments)).toEqual(["80%"]);
  });

  it("reads template magnitudes when the description prints the effect magnitude", () => {
    expect(enchantmentValues(row("Ricochet.III"), TABLES.enchantments)).toEqual(["22%"]);
  });

  it("uses a row's own abilities and texts when it has them", () => {
    expect(enchantmentValues(row("GravityPulse.Unique"), TABLES.enchantments)).toEqual(["7"]);
  });

  it("treats an Int key value as a whole percentage", () => {
    expect(enchantmentValues(row("ShadowStrike.I"), TABLES.enchantments)).toEqual(["8%"]);
  });

  it("is undefined when the row has no family to read values from", () => {
    expect(enchantmentValues(row("Shockwave.Unique"), TABLES.enchantments)).toBeUndefined();
  });
});

describe("buildEnchantmentData", () => {
  const { data } = buildEnchantmentData(ENTRIES, TABLES);

  it("gives each enchantment its printed values at tiers I, II and III", () => {
    expect(data["fire-aspect"]).toEqual({ tiers: [["35%"], ["45%"], ["55%"]] });
    expect(data.ricochet).toEqual({ tiers: [["10%"], ["16%"], ["22%"]] });
  });

  it("gives a unique enchantment with its own entry a single set of values", () => {
    expect(data["gravity-pulse-unique"]).toEqual({ tiers: [["7"]] });
  });
});
