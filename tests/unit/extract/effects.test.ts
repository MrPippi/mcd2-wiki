import { describe, expect, it } from "vitest";
import { buildEffectData } from "../../../scripts/extract/effects";
import type { Entry } from "../../../shared/schemas";
import { TABLES } from "../../helpers/datatables";
import { loc } from "../../helpers/localized";

const entry = (slug: string, id: string): Entry => ({
  id,
  slug,
  category: "effect",
  variant: "normal",
  release: "base",
  name: loc({ zh: id, en: id }),
  links: {},
});

describe("buildEffectData", () => {
  const data = buildEffectData([entry("critical-edge", "CriticalEdge"), entry("reconstruction", "Reconstruction"), entry("status-on-hit-strength", "StatusOnHit_Strength")], TABLES);

  it("prints each effect's tier I–III template magnitudes the way its description does", () => {
    expect(data["critical-edge"]).toEqual({ tiers: [["10%"], ["20%"], ["30%"]] });
  });

  it("leaves out effects without all three tiers or without a printable magnitude", () => {
    expect(data.reconstruction).toBeUndefined();
    expect(data["status-on-hit-strength"]).toBeUndefined();
  });
});
