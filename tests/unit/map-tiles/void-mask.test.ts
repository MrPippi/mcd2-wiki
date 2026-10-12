import { describe, expect, it } from "vitest";
import { clearVoid, dilate, isVoidColour, voidMask } from "../../../scripts/map-tiles/void-mask";

const VOID = [153, 146, 132] as const;
const GRASS = [70, 110, 40] as const;

/** An RGB image filled with `fill`, with `paint(x, y)` overriding single pixels. */
function image(width: number, height: number, fill: readonly number[], paint: (x: number, y: number) => readonly number[] | undefined = () => undefined): Uint8Array {
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      data.set(paint(x, y) ?? fill, (y * width + x) * 3);
    }
  }
  return data;
}

describe("isVoidColour", () => {
  it.each([
    [156, 148, 134],
    [150, 144, 129],
    [148, 140, 126],
    [145, 138, 123],
    [142, 135, 120],
  ])("accepts the baked void ground %i,%i,%i", (r, g, b) => {
    expect(isVoidColour(r, g, b)).toBe(true);
  });

  it.each([
    ["grass", 70, 110, 40],
    ["grey stone path", 128, 128, 128],
    ["sand", 205, 175, 110],
    ["water", 20, 40, 80],
    ["black inset frame", 0, 0, 0],
    ["dirt road", 150, 95, 50],
  ])("rejects %s", (_name, r, g, b) => {
    expect(isVoidColour(r, g, b)).toBe(false);
  });
});

describe("voidMask", () => {
  it("marks a large void region and leaves content alone", () => {
    const width = 100;
    const data = image(width, 100, VOID, (x) => (x < 50 ? GRASS : undefined));
    const mask = voidMask(data, width, 100, 1000);
    expect(mask[10 * width + 10]).toBe(0);
    expect(mask[10 * width + 90]).toBe(1);
    expect(mask.reduce((sum, v) => sum + v, 0)).toBe(50 * 100);
  });

  it("keeps a small void-coloured patch inside the content", () => {
    const width = 100;
    const data = image(width, 100, GRASS, (x, y) => (x >= 20 && x < 25 && y >= 20 && y < 25 ? VOID : undefined));
    const mask = voidMask(data, width, 100, 1000);
    expect(mask.every((v) => v === 0)).toBe(true);
  });

  it("does not join regions only through a diagonal", () => {
    const width = 4;
    // Void on the two diagonal corners only.
    const data = image(width, 4, GRASS, (x, y) => ((x < 2 && y < 2) || (x >= 2 && y >= 2) ? VOID : undefined));
    expect(Array.from(voidMask(data, width, 4, 5))).toEqual(new Array(16).fill(0));
    expect(Array.from(voidMask(data, width, 4, 4)).reduce((s, v) => s + v, 0)).toBe(8);
  });

  it("rejects data whose length does not match the size", () => {
    expect(() => voidMask(new Uint8Array(10), 2, 2, 1)).toThrow(RangeError);
  });
});

describe("dilate", () => {
  it("grows a mask by one pixel in the four directions", () => {
    const mask = new Uint8Array(9);
    mask[4] = 1;
    expect(Array.from(dilate(mask, 3, 3))).toEqual([0, 1, 0, 1, 1, 1, 0, 1, 0]);
  });

  it("does not wrap across rows", () => {
    const mask = Uint8Array.from([0, 0, 1, 0, 0, 0]);
    expect(Array.from(dilate(mask, 3, 2))).toEqual([0, 1, 1, 0, 0, 1]);
  });
});

describe("clearVoid", () => {
  // A 2x2 mask cell covers 2x2 full-size pixels (scale 2), so the RGBA image is 4x4.
  const rgba = (pixel: (x: number, y: number) => readonly number[], side = 4): Uint8Array => {
    const data = new Uint8Array(side * side * 4);
    for (let y = 0; y < side; y += 1) for (let x = 0; x < side; x += 1) data.set([...pixel(x, y), 255], (y * side + x) * 4);
    return data;
  };
  const alphaAt = (data: Uint8Array, x: number, y: number): number => data[(y * 4 + x) * 4 + 3];

  it("clears core void cells and only void-coloured pixels on the fringe", () => {
    const core = Uint8Array.from([1, 0, 0, 0]);
    const fringe = Uint8Array.from([1, 1, 1, 0]);
    const image = rgba((x) => (x === 3 ? GRASS : VOID));
    const out = clearVoid(image, 4, 4, { core, fringe, width: 2, scale: 2, left: 0, top: 0 });
    expect(alphaAt(out, 0, 0)).toBe(0); // core
    expect(alphaAt(out, 2, 0)).toBe(0); // fringe, void colour
    expect(alphaAt(out, 0, 2)).toBe(0); // fringe below, void colour
    expect(alphaAt(out, 3, 0)).toBe(255); // fringe, grass
    expect(alphaAt(out, 2, 2)).toBe(255); // outside the fringe
    expect(alphaAt(image, 0, 0)).toBe(255); // input untouched
  });

  it("reads the mask at the image's offset", () => {
    const core = Uint8Array.from([0, 0, 0, 1]);
    const out = clearVoid(rgba(() => GRASS, 2), 2, 2, { core, fringe: core, width: 2, scale: 2, left: 2, top: 2 });
    // The 2x2 image sits on mask cell (1,1).
    expect(Array.from({ length: 4 }, (_, i) => out[i * 4 + 3])).toEqual([0, 0, 0, 0]);
  });
});
