import { describe, expect, it } from "vitest";
import { TAB_HEIGHT, TAB_WIDTH, landBox, tabCrop, voidToAlpha } from "../../../scripts/map-tiles/tab-art";

/** A width x height RGB image, black except where `land(x, y)` is true. */
function rgb(width: number, height: number, land: (x: number, y: number) => boolean): Uint8Array {
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) if (land(x, y)) data.set([60, 120, 40], (y * width + x) * 3);
  return data;
}

describe("landBox", () => {
  it("is the smallest box around the non-black pixels", () => {
    const image = rgb(10, 8, (x, y) => x >= 2 && x <= 5 && y >= 3 && y <= 4);
    expect(landBox(image, 10, 8)).toEqual({ left: 2, top: 3, width: 4, height: 2 });
  });

  it("rejects an image with no land", () => {
    expect(() => landBox(rgb(4, 4, () => false), 4, 4)).toThrow(/陸地/);
  });
});

describe("tabCrop", () => {
  const ratio = TAB_WIDTH / TAB_HEIGHT;

  it("narrows a box that is too wide, keeping its centre", () => {
    const crop = tabCrop({ left: 0, top: 0, width: 1000, height: 100 });
    expect(crop.height).toBe(100);
    expect(crop.width / crop.height).toBeCloseTo(ratio, 1);
    expect(crop.left + crop.width / 2).toBeCloseTo(500, 0);
  });

  it("shortens a box that is too tall, keeping its centre", () => {
    const crop = tabCrop({ left: 10, top: 20, width: 240, height: 400 });
    expect(crop.width).toBe(240);
    expect(crop.width / crop.height).toBeCloseTo(ratio, 1);
    expect(crop.top + crop.height / 2).toBeCloseTo(220, 0);
  });
});

describe("voidToAlpha", () => {
  it("keeps land opaque and makes black transparent", () => {
    const out = voidToAlpha(rgb(2, 1, (x) => x === 0));
    expect(Array.from(out)).toEqual([60, 120, 40, 255, 0, 0, 0, 0]);
  });
});
