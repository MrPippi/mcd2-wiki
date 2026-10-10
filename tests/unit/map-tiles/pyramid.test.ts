import { describe, expect, it } from "vitest";
import { childrenOf, levelSize, levelTiles, sourceCut, sourceName, tileKey, tilesPerSide } from "../../../scripts/map-tiles/pyramid";

describe("tile pyramid", () => {
  it("halves the render per zoom level", () => {
    expect(levelSize(8192, 5, 5)).toBe(8192);
    expect(levelSize(8192, 5, 0)).toBe(256);
    expect(levelSize(7168, 5, 2)).toBe(896);
    expect(levelSize(3072, 4, 0)).toBe(192);
  });

  it("counts tiles per side, rounding partial tiles up", () => {
    expect(tilesPerSide(8192, 5, 5)).toBe(32);
    expect(tilesPerSide(7168, 5, 5)).toBe(28);
    expect(tilesPerSide(7168, 5, 2)).toBe(4);
    expect(tilesPerSide(3072, 4, 0)).toBe(1);
  });

  it("lists a level's tiles row by row", () => {
    expect(levelTiles(512, 1, 1)).toEqual([
      { z: 1, x: 0, y: 0 },
      { z: 1, x: 1, y: 0 },
      { z: 1, x: 0, y: 1 },
      { z: 1, x: 1, y: 1 },
    ]);
  });

  it("finds the four children of a tile and where they go in a 512px square", () => {
    expect(childrenOf({ z: 2, x: 1, y: 3 })).toEqual([
      { tile: { z: 3, x: 2, y: 6 }, left: 0, top: 0 },
      { tile: { z: 3, x: 3, y: 6 }, left: 256, top: 0 },
      { tile: { z: 3, x: 2, y: 7 }, left: 0, top: 256 },
      { tile: { z: 3, x: 3, y: 7 }, left: 256, top: 256 },
    ]);
  });

  it("cuts top-level tiles straight from the 1024px sources", () => {
    expect(sourceCut({ z: 5, x: 0, y: 0 })).toEqual({ row: 0, col: 0, left: 0, top: 0 });
    expect(sourceCut({ z: 5, x: 5, y: 18 })).toEqual({ row: 4, col: 1, left: 256, top: 512 });
  });

  it("names sources and tiles", () => {
    expect(sourceName("Overworld", 4, 0)).toBe("Overworld_04_00.png");
    expect(tileKey({ z: 3, x: 2, y: 7 })).toBe("3/2/7");
  });
});
