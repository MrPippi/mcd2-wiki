import { describe, expect, it } from "vitest";
import { isInside, toBlocks, toImagePixel, type WorldFrame } from "../../../src/lib/map/transform";

// Overworld, from DT_WorldRegionMapData.
const OVERWORLD: WorldFrame = { minX: -599, maxX: 444, minY: -172, maxY: 1371, span: 1544, ratio: 0.965, imageSize: 8192 };

const pixelOf = (X: number, Y: number) => toImagePixel(OVERWORLD, toBlocks({ X, Y }));

describe("map transform", () => {
  it("turns centimetres into blocks", () => {
    expect(toBlocks({ X: 13845, Y: -8750 })).toEqual({ x: 138.45, y: -87.5 });
  });

  it("anchors the bounds' minimum corner at the bottom-left of the render", () => {
    expect(toImagePixel(OVERWORLD, { x: -599, y: -172 })).toEqual({ px: 0, py: 8192 });
  });

  it("scales by the fancy map ratio", () => {
    const corner = toImagePixel(OVERWORLD, { x: -599 + 1544, y: -172 + 1544 });
    expect(corner.px).toBeCloseTo(8192 * 0.965, 6);
    expect(corner.py).toBeCloseTo(8192 * (1 - 0.965), 6);
  });

  // Landmarks checked by eye on Overworld_04_00.png on 2026-10-10 (spec §3.2).
  it.each([
    ["blacksmith", 16451.924232, -10210.710687, 357.9, 4282.8],
    ["enchantsmith", 12377.399827679914, -7221.256830370523, 510.9, 4491.4],
    ["merchant", 14800, -7460, 498.7, 4367.4],
    ["teleport statue", 13845, -8750, 432.6, 4416.3],
  ])("puts the %s on its building", (_name, X, Y, px, py) => {
    const pixel = pixelOf(X, Y);
    expect(Math.abs(pixel.px - px)).toBeLessThan(1);
    expect(Math.abs(pixel.py - py)).toBeLessThan(1);
  });

  it("tells whether a point lies inside the region bounds", () => {
    expect(isInside(OVERWORLD, { x: 0, y: 0 })).toBe(true);
    expect(isInside(OVERWORLD, { x: 444, y: 1371 })).toBe(true);
    expect(isInside(OVERWORLD, { x: 445, y: 0 })).toBe(false);
    expect(isInside(OVERWORLD, { x: 0, y: -173 })).toBe(false);
  });
});
