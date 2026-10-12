import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MapTilesError, buildWorldTiles } from "../../../scripts/map-tiles/build";

const WORLD = { key: "test", region: "Test", grid: 2 };
const COLOURS = [
  { r: 255, g: 0, b: 0 },
  { r: 0, g: 255, b: 0 },
  { r: 0, g: 0, b: 255 },
  { r: 255, g: 255, b: 0 },
];

let root: string;
let options: { sourceDir: string; outDir: string; quality: number };

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "mcd2-tiles-"));
  options = { sourceDir: path.join(root, "src"), outDir: path.join(root, "out"), quality: 80 };
  await mkdir(path.join(options.sourceDir, "Test"), { recursive: true });
  await Promise.all(
    COLOURS.map((background, index) =>
      sharp({ create: { width: 1024, height: 1024, channels: 4, background: { ...background, alpha: 1 } } })
        .png()
        .toFile(path.join(options.sourceDir, "Test", `Test_0${Math.floor(index / 2)}_0${index % 2}.png`)),
    ),
  );
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("buildWorldTiles", () => {
  it("writes every level of the pyramid down to one overview tile", async () => {
    const summary = await buildWorldTiles(WORLD, options);
    expect(summary).toMatchObject({ world: "test", tiles: 64 + 16 + 4 + 1, skipped: false });
    expect(summary.bytes).toBeGreaterThan(0);
    expect(existsSync(path.join(options.outDir, "test", "3", "7", "7.webp"))).toBe(true);
    const overview = sharp(await readFile(path.join(options.outDir, "test", "0", "0", "0.webp")));
    expect(await overview.metadata()).toMatchObject({ width: 256, height: 256, format: "webp" });
  });

  it("keeps each source in its own corner of the overview", async () => {
    await buildWorldTiles(WORLD, options);
    const { data, info } = await sharp(await readFile(path.join(options.outDir, "test", "0", "0", "0.webp"))).raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => Array.from(data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3));
    const near = (actual: number[], expected: { r: number; g: number; b: number }) =>
      Math.abs(actual[0] - expected.r) + Math.abs(actual[1] - expected.g) + Math.abs(actual[2] - expected.b) < 40;
    expect(near(pixel(64, 64), COLOURS[0])).toBe(true);
    expect(near(pixel(192, 64), COLOURS[1])).toBe(true);
    expect(near(pixel(64, 192), COLOURS[2])).toBe(true);
    expect(near(pixel(192, 192), COLOURS[3])).toBe(true);
  });

  it("skips a world whose sources have not changed", async () => {
    await buildWorldTiles(WORLD, options);
    expect(await buildWorldTiles(WORLD, options)).toEqual({ world: "test", tiles: 0, bytes: 0, skipped: true });
  });

  it("makes the baked void ground transparent and leaves the rest opaque", async () => {
    await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 153, g: 146, b: 132, alpha: 1 } } })
      .png()
      .toFile(path.join(options.sourceDir, "Test", "Test_01_01.png"));
    await buildWorldTiles(WORLD, options);
    const alpha = async (key: string): Promise<number> => {
      const { data, info } = await sharp(await readFile(path.join(options.outDir, "test", ...key.split("/")) + ".webp")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return data[(Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels + 3];
    };
    expect(await alpha("3/6/6")).toBe(0);
    expect(await alpha("3/1/1")).toBe(255);
  });

  it("rebuilds a world whose manifest predates the void mask", async () => {
    await buildWorldTiles(WORLD, options);
    const manifestPath = path.join(options.outDir, "test", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    await writeFile(manifestPath, JSON.stringify({ ...manifest, voidMask: undefined }));
    expect((await buildWorldTiles(WORLD, options)).skipped).toBe(false);
  });

  it("fails and names the missing sources", async () => {
    await rm(path.join(options.sourceDir, "Test", "Test_01_01.png"));
    await expect(buildWorldTiles(WORLD, options)).rejects.toThrow(MapTilesError);
    await expect(buildWorldTiles(WORLD, options)).rejects.toThrow("Test_01_01.png");
  });
});
