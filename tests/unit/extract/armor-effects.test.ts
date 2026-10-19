import { describe, expect, it } from "vitest";
import { buildArmorEffects } from "../../../scripts/extract/armor-effects";
import type { Entry } from "../../../shared/schemas";
import { TABLES } from "../../helpers/datatables";
import { loc } from "../../helpers/localized";

const entry = (category: Entry["category"], slug: string, id: string, variant: Entry["variant"] = "normal"): Entry => ({
  id,
  slug,
  category,
  variant,
  release: "base",
  name: loc({ zh: id, en: id }),
  links: {},
});

const ENTRIES: readonly Entry[] = [
  entry("armor", "hunter-helmet", "HunterHelmet"),
  entry("armor", "hunter-helmet-unique", "HunterHelmet_Unique", "unique"),
  entry("effect", "looting", "Looting"),
  entry("effect", "sharpness", "Sharpness"),
  entry("effect", "reconstruction", "Reconstruction"),
];

describe("buildArmorEffects", () => {
  const { data, issues } = buildArmorEffects(ENTRIES, TABLES);

  it("rolls only the effects the drop table gives armor, with tier values", () => {
    expect(data["hunter-helmet"]?.compatible).toEqual([{ effect: "looting", tiers: [0.2, 0.4, 0.6] }]);
  });

  it("names a unique piece's built-in effect", () => {
    expect(data["hunter-helmet-unique"]?.fixed).toEqual({ effect: "reconstruction", value: -0.35 });
    expect(data["hunter-helmet"]?.fixed).toBeUndefined();
  });

  it("skips rows without a site entry and reports nothing for these", () => {
    expect(Object.keys(data).sort()).toEqual(["hunter-helmet", "hunter-helmet-unique"]);
    expect(issues).toEqual([]);
  });
});
