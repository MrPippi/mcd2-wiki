import { describe, expect, it } from "vitest";
import type { WorldMap } from "../../../scripts/extract/map-schema";
import { trimWorld } from "../../../src/lib/map/payload";
import { loc } from "../../helpers/localized";

const WORLD: WorldMap = {
  key: "overworld",
  name: loc({ en: "Overworld", zh: "主世界", ja: "オーバーワールド" }),
  frame: { minX: 0, maxX: 1, minY: 0, maxY: 1, span: 1, ratio: 1, imageSize: 256 },
  zMax: 0,
  markers: [
    {
      id: "rift1",
      kind: "rift",
      px: 1,
      py: 2,
      name: loc({ en: "Rift", ja: "リフト" }),
      area: loc({ en: "Howling Woods", ja: "ハウリングウッズ" }),
      note: loc({ en: "Enter to find loot." }),
      icon: "icons/map/rift.png",
    },
    { id: "smith", kind: "merchant", px: 3, py: 4, name: loc({ en: "Blacksmith" }) },
  ],
};

describe("trimWorld", () => {
  it("keeps only the given languages in the world and marker texts", () => {
    const trimmed = trimWorld(WORLD, ["ja", "en"]);
    expect(trimmed.name).toEqual({ ja: "オーバーワールド", en: "Overworld" });
    expect(trimmed.markers[0]).toEqual({
      id: "rift1",
      kind: "rift",
      px: 1,
      py: 2,
      name: { ja: "リフト", en: "Rift" },
      area: { ja: "ハウリングウッズ", en: "Howling Woods" },
      note: { ja: "Enter to find loot.", en: "Enter to find loot." },
      icon: "icons/map/rift.png",
    });
    expect(trimmed.markers[1]).toEqual({ id: "smith", kind: "merchant", px: 3, py: 4, name: { ja: "Blacksmith", en: "Blacksmith" } });
    expect(trimmed.frame).toEqual(WORLD.frame);
  });

  it("does not change the input", () => {
    const copy = structuredClone(WORLD);
    trimWorld(WORLD, ["en", "zh"]);
    expect(WORLD).toEqual(copy);
  });
});
