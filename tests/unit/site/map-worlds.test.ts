import { describe, expect, it } from "vitest";
import { WORLDS, WORLD_KEYS, imageSizeOf, zMaxFor } from "../../../shared/map/worlds";

describe("map worlds", () => {
  it("lists the three worlds in display order", () => {
    expect(WORLD_KEYS).toEqual(["overworld", "sift", "camp"]);
    expect(WORLDS.map((world) => [world.key, world.region, world.grid])).toEqual([
      ["overworld", "Overworld", 8],
      ["sift", "Sift", 7],
      ["camp", "Camp", 3],
    ]);
  });

  it("sizes the stitched render from the 1024px source grid", () => {
    expect(imageSizeOf({ grid: 8 })).toBe(8192);
    expect(imageSizeOf({ grid: 3 })).toBe(3072);
  });

  it("picks the zoom where one tile pixel is one render pixel", () => {
    expect(zMaxFor(8192)).toBe(5);
    expect(zMaxFor(7168)).toBe(5);
    expect(zMaxFor(3072)).toBe(4);
    expect(zMaxFor(2048)).toBe(3);
    expect(zMaxFor(256)).toBe(0);
  });
});
